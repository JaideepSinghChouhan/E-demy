import User from "../models/User.js"
import { Purchase } from "../models/Purchase.js";
import Stripe from "stripe"
import Course from "../models/Course.js";
import { CourseProgress } from "../models/CourseProgress.js";
import { clerkClient } from "@clerk/express";
//get user data
export const getUserData = async (req, res)=>{
    try {
        const userId = req.auth.userId
        const user = await User.findById(userId)

        if(!user){
            return res.json({success: false, message: 'User not found '})
        }
        res.json({success: true, user})
    } catch (error) {
        res.json({success: false, message: error.message})
    }
}
//user enrolled courses with lecture links
export const userEnrolledCourses = async (req, res)=>{
    try {
        const userId = req.auth.userId
        const userData = await User.findById(userId).populate('enrolledCourses')
        if (!userData) {
            return res.json({ success: true, enrolledCourses: [] })
        }
        res.json({success: true, enrolledCourses: userData.enrolledCourses})
    } catch (error) {
        res.json({success: false, message: error.message})
    }
}

//purchase course
export const purchaseCourse = async (req, res)=>{
    try {
        const { courseId } = req.body
        const { origin } = req.headers
        const userId = req.auth.userId
        const courseData = await Course.findById(courseId)

        if(!courseData){
            return res.json({success: false, message: 'Course not found'})
        }

        // Auto-create user in MongoDB if webhook missed them
        let userData = await User.findById(userId)
        if (!userData) {
            const clerkUser = await clerkClient.users.getUser(userId)
            userData = await User.create({
                _id: userId,
                name: clerkUser.firstName + ' ' + clerkUser.lastName,
                email: clerkUser.emailAddresses[0].emailAddress,
                imageUrl: clerkUser.imageUrl,
            })
        }

        const purchaseData = {
            courseId: courseData._id,
            userId,
            amount: (courseData.coursePrice - courseData.discount * courseData.
                coursePrice / 100).toFixed(2),
        }
        const newPurchase = await Purchase.create(purchaseData)

        //stripe gateway initialise
        const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)
        const currency = process.env.CURRENCY.toLowerCase()

        //creating line items to fro stripe
        const line_items = [{
            price_data:{
                currency,
                product_data: {
                    name: courseData.courseTitle
                },
                unit_amount: Math.floor(newPurchase.amount) * 100
            },
            quantity: 1
        }]
        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/loading/my-enrollments?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/`,
            line_items: line_items,
            mode: 'payment',
            metadata: {
                purchaseId: newPurchase._id.toString()
            }
        })
        res.json({success: true, session_url: session.url})
    } catch (error) {
        res.json({success: false, message: error.message});
    }
}

// verify stripe payment and enroll user (fallback when webhook hasn't fired yet)
export const verifyPayment = async (req, res) => {
    try {
        const { sessionId } = req.body
        const userId = req.auth.userId
        const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)

        const session = await stripeInstance.checkout.sessions.retrieve(sessionId)
        if (session.payment_status !== 'paid') {
            return res.json({ success: false, message: 'Payment not completed' })
        }

        const { purchaseId } = session.metadata
        const purchase = await Purchase.findById(purchaseId)

        if (!purchase) return res.json({ success: false, message: 'Purchase not found' })
        if (purchase.status === 'completed') {
            return res.json({ success: true, message: 'Already enrolled' })
        }

        // Mark purchase complete
        purchase.status = 'completed'
        await purchase.save()

        // Enroll user in course
        const course = await Course.findById(purchase.courseId)
        const user = await User.findById(userId)

        if (course && user) {
            if (!course.enrolledStudents.includes(userId)) {
                course.enrolledStudents.push(userId)
                await course.save()
            }
            if (!user.enrolledCourses.includes(purchase.courseId)) {
                user.enrolledCourses.push(purchase.courseId)
                await user.save()
            }
        }

        res.json({ success: true, message: 'Enrollment confirmed' })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

// update user course progress
export const updateUserCourseProgress = async (req, res) => {
    try {
        const userId = req.auth.userId
        const { courseId, lectureId } = req.body
        const progressData = await CourseProgress.findOne({ userId, courseId })
        if (progressData) {
            if (progressData.lectureCompleted.includes(lectureId)) {
                // unmark complete
                progressData.lectureCompleted = progressData.lectureCompleted.filter(id => id !== lectureId)
            } else {
                progressData.lectureCompleted.push(lectureId)
            }
            await progressData.save()
        } else {
            await CourseProgress.create({ userId, courseId, lectureCompleted: [lectureId] })
        }
        res.json({ success: true, message: 'Progress Updated' })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

// get user course progress
export const getUserCourseProgress = async (req, res) => {
    try {
        const userId = req.auth.userId
        const { courseId } = req.body
        const progressData = await CourseProgress.findOne({ userId, courseId })
        res.json({ success: true, progressData })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

// add rating to course
export const addUserRating = async (req, res) => {
    const userId = req.auth.userId
    const { courseId, rating } = req.body
    if (!courseId || !userId || !rating || rating < 1 || rating > 5) {
        return res.json({ success: false, message: 'Invalid rating data' })
    }
    try {
        const course = await Course.findById(courseId)
        if (!course) return res.json({ success: false, message: 'Course not found' })

        const user = await User.findById(userId)
        if (!user || !user.enrolledCourses.includes(courseId)) {
            return res.json({ success: false, message: 'User has not purchased this course' })
        }
        const existingRatingIndex = course.courseRatings.findIndex(r => r.userId === userId)
        if (existingRatingIndex > -1) {
            course.courseRatings[existingRatingIndex].rating = rating
        } else {
            course.courseRatings.push({ userId, rating })
        }
        await course.save()
        res.json({ success: true, message: 'Rating Added' })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

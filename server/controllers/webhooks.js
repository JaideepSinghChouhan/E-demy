import { Webhook } from "svix";
import User from "../models/User.js";
import Stripe from "stripe";
import { Purchase } from "../models/Purchase.js";
import Course from "../models/Course.js";

//api controller function to manage clerk user with database

export const clerkWebhooks = async (req, res)=>{
    try{
        const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET)

        await whook.verify(JSON.stringify(req.body), {
            "svix-id": req.headers["svix-id"],
            "svix-timestamp": req.headers["svix-timestamp"],
            "svix-signature": req.headers["svix-signature"]
        })

        const {data, type} = req.body

        switch (type) {
            case 'user.created': {
                const userData = {
                    _id: data.id,
                    email: data.email_addresses[0].email_address,
                    name: data.first_name + " " + data.last_name,
                    imageUrl: data.image_url,
                }
                await User.create(userData)
                res.json({})
                break;
            }
           case 'user.updated': {
                const userData = {
                    email: data.email_addresses[0].email_address,
                    name: data.first_name + " " + data.last_name,
                    imageUrl: data.image_url,
                }
                await User.findByIdAndUpdate(data.id, userData)
                res.json({})
                break;
            }

            case 'user.deleted' :{
                await User.findByIdAndDelete(data.id)
                res.json({})
                break;
            }



            
            default:
                break;
        }


    }

    catch (error) {
        res.json({success: false, message: error.message})
    }

}

const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)

export const stripeWebhooks = async (request, response) => {
    const sig = request.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        // Use the raw body from the request for verification
        event = stripeInstance.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
        console.error(`Webhook signature verification failed.`, err.message);
        return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const { purchaseId } = session.metadata;
            console.log(`Checkout session completed for purchaseId: ${purchaseId}`);

            // Check if purchaseId exists in metadata
            if (!purchaseId) {
                console.error("Error: purchaseId not found in session metadata.");
                // Return 200 to Stripe so it doesn't retry this failed event
                return response.json({ received: true });
            }
            
            try {
                // Find the purchase and update its status
                const purchase = await Purchase.findById(purchaseId);
                if (!purchase || purchase.status === 'completed') {
                    console.log("Purchase not found or already completed.");
                    return response.json({ received: true });
                }

                purchase.status = 'completed';
                await purchase.save();

                // Enroll user in the course
                const course = await Course.findById(purchase.courseId);
                const user = await User.findById(purchase.userId);

                if (course && user) {
                    // FIX: Push the user's ID, not the entire user object
                    course.enrolledStudents.push(user._id);
                    await course.save();

                    user.enrolledCourses.push(course._id);
                    await user.save();
                }
                
                console.log(`Purchase ${purchaseId} successfully completed.`);

            } catch (dbError) {
                console.error("Database update failed:", dbError);
                // Send a 500 error to have Stripe retry the webhook
                return response.status(500).json({ error: 'Database update failed' });
            }

            break;
        }

        case 'payment_intent.payment_failed': {
            const paymentIntent = event.data.object;
            // You might not have session metadata here easily. 
            // Handling failures often requires a different logic if you need to find the original purchase.
            // For now, we assume you might find the purchase via a different identifier if needed.
            console.log(`Payment failed for PaymentIntent: ${paymentIntent.id}`);
            // You could potentially find the purchase via a paymentIntentId if you stored it at creation.
            break;
        }

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    response.json({ received: true });
};
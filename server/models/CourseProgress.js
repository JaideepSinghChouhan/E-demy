import mongoose from "mongoose";

const courseProgressSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    courseId: { type: String, required: true },
    lectureCompleted: [{ type: String }], // stores lectureId strings
}, { timestamps: true });

export const CourseProgress = mongoose.model('CourseProgress', courseProgressSchema)

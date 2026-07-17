import mongoose from "mongoose";

const circularEmbeddingSchema = new mongoose.Schema(
  {
    circularId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Circular",
      required: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    page: {
      type: Number,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
    metadata: {
      source: { type: String },
      circularNumber: { type: String },
      title: { type: String },
    },
  },
  { timestamps: true }
);

// Optional: Add index on circularId for faster deletions
circularEmbeddingSchema.index({ circularId: 1 });

export default mongoose.model("CircularEmbedding", circularEmbeddingSchema);

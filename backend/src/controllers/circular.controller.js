import * as circularService from "../services/circular.service.js";
import { ingestCircular, extractFullText } from "../services/ingestion.service.js";
import { generateKeyPointsFromText } from "../services/summary.service.js";
import Circular from "../models/Circular.model.js";
import User from "../models/User.model.js";
import CircularEmbedding from "../models/CircularEmbedding.js";
import { generateEmbedding } from "../services/embedding.service.js";
import { visibilityQuery } from "../utils/visibility.util.js";
import { DEPARTMENTS, ALL_DEPARTMENTS } from "../config/departments.js";
import translationService from "../translation/translationService.js";

/**
 * Handle HTTP request for PDF upload
 */
export async function uploadCircularFile(req, res) {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    if (files.length === 0) {
      return res.status(400).json({ error: "Please upload at least one PDF file." });
    }

    let departments = [];
    let departmentConfirmed = false;
    if (req.body.departments) {
      try {
        departments = JSON.parse(req.body.departments);
      } catch (e) {
        if (typeof req.body.departments === "string") {
          departments = req.body.departments.split(",").map(d => d.trim()).filter(Boolean);
        } else if (Array.isArray(req.body.departments)) {
          departments = req.body.departments;
        }
      }
      if (departments.length > 0) {
        departmentConfirmed = true;
      }
    } else if (req.body.department) {
      departments = [req.body.department];
      departmentConfirmed = true;
    }

    const uploadedCirculars = [];
    for (const file of files) {
      const fileTitle = (files.length === 1 && req.body.title)
        ? req.body.title
        : file.originalname.replace(/\.[^/.]+$/, "");

      const circular = await circularService.createCircular({
        title: fileTitle,
        filename: file.filename,
        filepath: file.path,
        mimeType: file.mimetype,
        size: file.size,
        userId: req.user.id,
        circularNumber: req.body.circularNumber || "",
        category: req.body.category || "",
        priority: req.body.priority || "",
        issueDate: req.body.issueDate ? new Date(req.body.issueDate) : undefined,
        effectiveDate: req.body.effectiveDate ? new Date(req.body.effectiveDate) : undefined,
        departments: departments,
        departmentConfirmed: departmentConfirmed,
        remarks: req.body.remarks || "",
      });

      try {
        await ingestCircular(circular._id);
      } catch (ingestErr) {
        console.error(`Ingestion failed during upload for circular ${circular._id}:`, ingestErr);
      }

      const updated = await Circular.findById(circular._id).populate("uploadedBy", "name email designation");
      uploadedCirculars.push(updated);
    }

    res.status(201).json({
      message: `${uploadedCirculars.length} circular(s) uploaded and processed successfully.`,
      circulars: uploadedCirculars,
      circular: uploadedCirculars[0],
    });
  } catch (err) {
    console.error("Error in uploadCircularFile:", err);
    res.status(500).json({ error: "Failed to upload and index circulars." });
  }
}

export async function listCirculars(req, res) {
  try {
    const circulars = await circularService.getAllCirculars();
    res.json(circulars);
  } catch (err) {
    console.error("Error in listCirculars:", err);
    res.status(500).json({ error: "Failed to retrieve circulars." });
  }
}

/**
 * Handle deleting a circular
 */
export async function deleteCircular(req, res) {
  const { id } = req.params;
  try {
    const circular = await circularService.deleteCircular(id);
    res.json({
      message: "Circular deleted successfully.",
      circular,
    });
  } catch (err) {
    console.error("Error in deleteCircular:", err);
    if (err.message === "Circular not found") {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to delete circular." });
  }
}

/**
 * Handle "Summarize" / "Key Points" quick actions
 */
export async function getCircularInsight(req, res) {
  const { id } = req.params;
  const type = req.query.type === "keypoints" ? "keypoints" : "summary";

  try {
    const circular = await Circular.findById(id);
    if (!circular) return res.status(404).json({ error: "Circular not found" });

    if (circular.status !== "ingested") {
      return res.status(409).json({
        error: `This circular is still ${circular.status}. Try again once it's ready.`,
      });
    }

    let payload = { type, title: circular.title, content: circular.summary || "No summary available." };
    if (type === "keypoints") {
      if (circular.keyPoints) {
        payload = { type, title: circular.title, content: circular.keyPoints };
      } else {
        const fullText = await extractFullText(circular);
        const keyPoints = await generateKeyPointsFromText(fullText);
        circular.keyPoints = keyPoints;
        await circular.save();
        payload = { type, title: circular.title, content: keyPoints };
      }
    }

    return res.json(payload);
  } catch (err) {
    console.error("Error in getCircularInsight:", err);
    res.status(500).json({ error: "Failed to generate this insight." });
  }
}

/**
 * Handle retrieving status for a single circular
 */
export async function getCircularStatus(req, res) {
  const { id } = req.params;
  try {
    const circular = await circularService.getCircularById(id);
    if (!circular) {
      return res.status(404).json({ error: "Circular not found" });
    }
    res.json(circular);
  } catch (err) {
    console.error("Error in getCircularStatus:", err);
    res.status(500).json({ error: "Failed to retrieve circular status." });
  }
}

/**
 * GET /api/circulars/feed
 */
export async function getCircularFeed(req, res) {
  try {
    const employee = await User.findById(req.user.id);
    if (!employee) return res.status(404).json({ error: "User not found." });

    const circulars = await Circular.find({
      status: "ingested",
      ...visibilityQuery(employee),
    })
      .sort({ createdAt: -1 })
      .select("title summary departments aiSuggestedDepartments district createdAt pdfUrl");

    const Task = (await import("../models/Task.model.js")).default;
    const addedTasks = await Task.find({
      employee: employee._id,
      circularId: { $exists: true, $ne: null }
    }).select("circularId");
    
    const addedCircularIds = new Set(addedTasks.map(t => t.circularId.toString()));

    const result = circulars.map(c => {
      const cObj = c.toObject();
      cObj.addedToPlanner = addedCircularIds.has(c._id.toString());
      return cObj;
    });

    res.json(result);
  } catch (err) {
    console.error("Error in getCircularFeed:", err);
    res.status(500).json({ error: "Failed to load circular feed." });
  }
}

/**
 * PATCH /api/circulars/:id/department
 */
export async function updateCircularDepartments(req, res) {
  const { id } = req.params;
  const { departments, district } = req.body;

  if (!Array.isArray(departments) || departments.length === 0) {
    return res.status(400).json({ error: "departments must be a non-empty array." });
  }

  const validTags = [...DEPARTMENTS, ALL_DEPARTMENTS];
  const invalid = departments.filter((d) => !validTags.includes(d));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Unknown department(s): ${invalid.join(", ")}` });
  }

  try {
    const circular = await Circular.findById(id);
    if (!circular) return res.status(404).json({ error: "Circular not found" });

    circular.departments = departments;
    circular.departmentConfirmed = true;
    if (district) circular.district = district;
    await circular.save();

    res.json({ circular });
  } catch (err) {
    console.error("Error in updateCircularDepartments:", err);
    res.status(500).json({ error: "Failed to update department tags." });
  }
}

/**
 * Semantic search on circulars
 */
export async function searchCirculars(req, res) {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Search query is required." });
    }

    const queryVector = await generateEmbedding(query);

    const pipeline = [
      {
        $vectorSearch: {
          index: "circular_vector_index",
          path: "embedding",
          queryVector: queryVector,
          numCandidates: 100,
          limit: 5,
        },
      },
      {
        $project: {
          _id: 1,
          circularId: 1,
          chunkIndex: 1,
          page: 1,
          text: 1,
          metadata: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    const results = await CircularEmbedding.aggregate(pipeline);

    const finalResults = [];
    for (const match of results) {
      const circular = await Circular.findById(match.circularId);
      if (!circular) continue;

      finalResults.push({
        _id: circular._id,
        title: circular.title,
        circularNumber: circular.circularNumber || "",
        similarityScore: match.score,
        summary: circular.summary,
        department: circular.departments[0] || circular.department || "Local Self Government",
        departments: circular.departments,
        category: circular.category || "Circular",
        pdfUrl: circular.pdfUrl || `/uploads/${circular.filename}`,
        excerpt: match.text,
        page: match.page,
      });
    }

    res.json(finalResults);
  } catch (err) {
    console.error("Error in searchCirculars:", err);
    res.status(500).json({ error: "Failed to perform semantic search." });
  }
}

/**
 * Reprocess a circular
 */
export async function reprocessCircular(req, res) {
  const { id } = req.params;
  try {
    const circular = await Circular.findById(id);
    if (!circular) return res.status(404).json({ error: "Circular not found" });

    await ingestCircular(circular._id);

    const updated = await Circular.findById(circular._id).populate("uploadedBy", "name email designation");
    res.json({
      message: "Circular reprocessed and indexed successfully.",
      circular: updated,
    });
  } catch (err) {
    console.error("Error in reprocessCircular:", err);
    res.status(500).json({ error: "Failed to reprocess circular." });
  }
}

/**
 * Update circular metadata attributes
 */
export async function updateCircularMetadata(req, res) {
  const { id } = req.params;
  const {
    title,
    circularNumber,
    category,
    priority,
    issueDate,
    effectiveDate,
    departments,
    remarks
  } = req.body;

  try {
    const circular = await Circular.findById(id);
    if (!circular) return res.status(404).json({ error: "Circular not found" });

    if (title !== undefined) circular.title = title;
    if (circularNumber !== undefined) circular.circularNumber = circularNumber;
    if (category !== undefined) circular.category = category;
    if (priority !== undefined) circular.priority = priority;
    if (issueDate !== undefined) circular.issueDate = issueDate ? new Date(issueDate) : undefined;
    if (effectiveDate !== undefined) circular.effectiveDate = effectiveDate ? new Date(effectiveDate) : undefined;
    if (remarks !== undefined) circular.remarks = remarks;

    if (Array.isArray(departments)) {
      circular.departments = departments;
      circular.departmentConfirmed = true;
      if (departments.length > 0) {
        circular.department = departments[0];
      }
    }

    await circular.save();

    const updated = await Circular.findById(circular._id).populate("uploadedBy", "name email designation");
    res.json({
      message: "Circular metadata updated successfully.",
      circular: updated,
    });
  } catch (err) {
    console.error("Error in updateCircularMetadata:", err);
    res.status(500).json({ error: "Failed to update circular metadata." });
  }
}

/**
 * GET /api/circulars/:id/task-suggestion
 */
export async function getCircularTaskSuggestion(req, res) {
  const { id } = req.params;
  try {
    const circular = await Circular.findById(id);
    if (!circular) return res.status(404).json({ error: "Circular not found" });

    const todayStr = new Date().toISOString().split("T")[0];
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 3);
    const defaultDueDateStr = defaultDueDate.toISOString().split("T")[0];

    let resultPayload = {
      title: `Review Circular: ${circular.title}`,
      dueDate: defaultDueDateStr,
      priority: "Medium",
      category: "Government Circular",
      source: "Circular",
      circularId: circular._id,
    };

    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey && apiKey !== "your_groq_api_key_here") {
      const { ChatGroq } = await import("@langchain/groq");
      const { PromptTemplate } = await import("@langchain/core/prompts");
      const { StringOutputParser } = await import("@langchain/core/output_parsers");

      const promptTemplate = `You are an AI assistant for Kerala Government Local Self Government employees.
Analyze the following government circular details:
Title: {title}
Summary: {summary}

Suggest:
1. An appropriate due date (in YYYY-MM-DD format) considering any deadlines mentioned in the circular. If no deadline is mentioned, suggest a due date exactly 3 days from today's date ({today}).
2. A priority level: "High", "Medium", or "Low" based on the urgency of the circular.

Return ONLY a valid JSON object matching this schema:
{{
  "dueDate": "YYYY-MM-DD",
  "priority": "High" | "Medium" | "Low"
}}
Do NOT return any other text, explanations, or markdown.`;

      const llm = new ChatGroq({
        apiKey,
        model: "llama-3.1-8b-instant",
        temperature: 0.1,
      });

      const prompt = PromptTemplate.fromTemplate(promptTemplate);
      const parser = new StringOutputParser();
      const chain = prompt.pipe(llm).pipe(parser);

      const raw = await chain.invoke({
        title: circular.title,
        summary: circular.summary || circular.remarks || "",
        today: todayStr,
      });

      const cleaned = raw.trim().replace(/^```json\s*|```$/g, "").trim();
      const parsed = JSON.parse(cleaned);

      resultPayload = {
        title: `Review Circular: ${circular.title}`,
        dueDate: parsed.dueDate || defaultDueDateStr,
        priority: parsed.priority || "Medium",
        category: "Government Circular",
        source: "Circular",
        circularId: circular._id,
      };
    }

    return res.json(resultPayload);
  } catch (err) {
    console.error("Error in getCircularTaskSuggestion:", err);
    try {
      const circular = await Circular.findById(id);
      const defaultDueDate = new Date();
      defaultDueDate.setDate(defaultDueDate.getDate() + 3);
      const defaultDueDateStr = defaultDueDate.toISOString().split("T")[0];
      return res.json({
        title: circular ? `Review Circular: ${circular.title}` : "Review Circular",
        dueDate: defaultDueDateStr,
        priority: "Medium",
        category: "Government Circular",
        source: "Circular",
        circularId: id,
      });
    } catch (e) {
      return res.status(500).json({ error: "Failed to generate task suggestion." });
    }
  }
}
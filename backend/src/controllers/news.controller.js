import News from "../models/News.model.js";
import User from "../models/User.model.js";
import { visibilityQuery } from "../utils/visibility.util.js";
import { DEPARTMENTS, ALL_DEPARTMENTS } from "../config/departments.js";

/**
 * POST /api/news
 * Restricted (see news.routes.js) to department_head/district_admin/state_admin,
 * so regular employees can't post announcements to everyone.
 */
export async function createNews(req, res) {
  const { title, body, departments, district } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: "title and body are required." });
  }
  if (!Array.isArray(departments) || departments.length === 0) {
    return res.status(400).json({ error: "departments must be a non-empty array." });
  }
  const validTags = [...DEPARTMENTS, ALL_DEPARTMENTS];
  const invalid = departments.filter((d) => !validTags.includes(d));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Unknown department(s): ${invalid.join(", ")}` });
  }

  try {
    const news = await News.create({
      title,
      body,
      departments,
      district: district || undefined,
      postedBy: req.user.id,
    });
    res.status(201).json({ news });
  } catch (err) {
    console.error("Error in createNews:", err);
    res.status(500).json({ error: "Failed to post news." });
  }
}

/**
 * GET /api/news/feed
 * Department/district-filtered, same visibility rule as circulars.
 */
export async function getNewsFeed(req, res) {
  try {
    const employee = await User.findById(req.user.id);
    if (!employee) return res.status(404).json({ error: "User not found." });

    const news = await News.find(visibilityQuery(employee))
      .sort({ createdAt: -1 })
      .populate("postedBy", "name designation");

    res.json(news);
  } catch (err) {
    console.error("Error in getNewsFeed:", err);
    res.status(500).json({ error: "Failed to load news feed." });
  }
}

/**
 * GET /api/news
 * Unfiltered list, for admins managing announcements.
 */
export async function listAllNews(req, res) {
  try {
    const news = await News.find().sort({ createdAt: -1 }).populate("postedBy", "name designation");
    res.json(news);
  } catch (err) {
    console.error("Error in listAllNews:", err);
    res.status(500).json({ error: "Failed to load news." });
  }
}

export async function deleteNews(req, res) {
  const { id } = req.params;
  try {
    const news = await News.findByIdAndDelete(id);
    if (!news) return res.status(404).json({ error: "News item not found." });
    res.json({ message: "News item deleted.", news });
  } catch (err) {
    console.error("Error in deleteNews:", err);
    res.status(500).json({ error: "Failed to delete news item." });
  }
}
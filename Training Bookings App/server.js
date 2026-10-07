import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import methodOverride from "method-override";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// ---------- Models ----------

const User = mongoose.model("User", new mongoose.Schema({
  fname: String,
  lname: String,
  phone: String,
  email: String,
  personId: { type: String, maxlength: 10 },
  createdAt: { type: Date, default: Date.now }
}));

const Booking = mongoose.model("Booking", new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  personId: String,
  dateTime: String,
  cardNumber: String,
  createdAt: { type: Date, default: Date.now }
}));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB error:", err));

// Escape user input before dropping it into a $regex so search terms
// can't be used to build unexpected/expensive regular expressions.
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- Static pages ----------

app.get("/", (req, res) => res.render("home"));
app.get("/about", (req, res) => res.render("about"));
app.get("/help", (req, res) => res.render("help"));

// ---------- Bookings ----------

// View all bookings (+ the create-booking form, which needs the user list for its dropdown)
app.get("/bookings", async (req, res) => {
  const bookings = await Booking.find().populate("user").sort({ createdAt: -1 });
  const users = await User.find().sort({ lname: 1, fname: 1 });
  res.render("bookings", { bookings, users });
});

// Create new booking
app.post("/bookings", async (req, res) => {
  const { user, personId, dateTime, cardNumber } = req.body;
  await Booking.create({ user, personId, dateTime, cardNumber });
  res.redirect("/bookings");
});

// Edit booking form
app.get("/bookings/:id/edit", async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate("user");
  if (!booking) return res.status(404).send("Booking not found");
  const users = await User.find().sort({ lname: 1, fname: 1 });
  res.render("bookings-edit", { booking, users });
});

// Update booking
app.put("/bookings/:id", async (req, res) => {
  const { user, personId, dateTime, cardNumber } = req.body;
  await Booking.findByIdAndUpdate(req.params.id, { user, personId, dateTime, cardNumber });
  res.redirect("/bookings");
});

// Delete booking
app.delete("/bookings/:id", async (req, res) => {
  await Booking.findByIdAndDelete(req.params.id);
  res.redirect("/bookings");
});

// ---------- Users ----------

// Create-user form
app.get("/users/new", (req, res) => res.render("users-new"));

// Create user
app.post("/users", async (req, res) => {
  const { fname, lname, phone, email, personId } = req.body;
  await User.create({ fname, lname, phone, email, personId });
  res.redirect("/bookings");
});

// Edit-user form
app.get("/users/:id/edit", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).send("User not found");
  const returnTo = req.query.returnTo || "/search";
  res.render("users-edit", { user, returnTo });
});

// Update user
app.put("/users/:id", async (req, res) => {
  const { fname, lname, phone, email, personId, returnTo } = req.body;
  await User.findByIdAndUpdate(req.params.id, { fname, lname, phone, email, personId });
  res.redirect(returnTo || "/search");
});

// Delete user
app.delete("/users/:id", async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  const { returnTo } = req.body;
  res.redirect(returnTo || "/search");
});

// ---------- Search ----------

// Search form
app.get("/search", (req, res) => res.render("search"));

// Search results — looks users up by whichever fields were filled in
app.get("/search/results", async (req, res) => {
  try {
    const { fname, lname, phone, email, personId } = req.query;

    const mongoQuery = {};
    if (fname && fname.trim() !== "") mongoQuery.fname = { $regex: escapeRegex(fname), $options: "i" };
    if (lname && lname.trim() !== "") mongoQuery.lname = { $regex: escapeRegex(lname), $options: "i" };
    if (phone && phone.trim() !== "") mongoQuery.phone = { $regex: escapeRegex(phone) };
    if (email && email.trim() !== "") mongoQuery.email = { $regex: escapeRegex(email), $options: "i" };
    if (personId && personId.trim() !== "") mongoQuery.personId = { $regex: escapeRegex(personId), $options: "i" };

    const users = await User.find(mongoQuery).sort({ lname: 1, fname: 1 });
    const returnTo = `/search/results?${new URLSearchParams(req.query).toString()}`;
    res.render("search-results", { users, returnTo });
  } catch (error) {
    console.error("Search system error:", error);
    res.status(500).send("An error occurred while executing the search.");
  }
});

app.listen(process.env.PORT, () =>
  console.log(`Server running on http://localhost:${process.env.PORT}`)
);

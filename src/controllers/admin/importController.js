import fs from "fs";
import xlsx from "xlsx";
import UserModel from "../../models/userModel.js";

const VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const VALID_GENDERS = ["male", "female", "other"];

const HEADER_ALIASES = {
  phone: [
    "phone",
    "phone number",
    "mobile",
    "mobile number",
    "contact",
    "contact number",
    "ph",
    "tel",
    "telephone",
    "cell",
    "cellphone",
    "whatsapp",
    "whatsapp number",
  ],
  name: [
    "name",
    "full name",
    "person",
    "contact name",
    "user",
    "patient name",
    "contact",
  ],
  address: [
    "address",
    "addr",
    "street",
    "street address",
    "house",
    "flat",
    "door no",
    "address line",
  ],
  place: [
    "place",
    "city",
    "town",
    "village",
    "district",
    "area",
    "locality",
    "location",
  ],
  dateOfBirth: [
    "dateOfBirth",
    "dob",
    "date of birth",
    "birthdate",
    "birthday",
    "d-o-b",
    "birth day",
  ],
  gender: ["gender", "sex", "gndr"],
  bloodGroup: [
    "blood group",
    "blood type",
    "group",
    "bg",
    "blood",
    "bgroup",
    "bloodGroup",
  ],
  isDonor: [
    "isDonor",
    "donor",
    "is donor",
    "donates",
    "willing to donate",
    "can donate",
    "donor?",
    "ready to donate",
    "donor",
    "donor status",
  ],
  lastDonationDate: [
    "lastDonationDate",
    "last donation date",
    "last donated",
    "last donation",
    "previous donation",
    "last blood donation",
    "last donated on",
    "donated on",
  ],
};

// quick lookup: normalized header string -> canonical key
const HEADER_CANON_LOOKUP = (() => {
  const map = new Map();
  const norm = (s) =>
    String(s)
      .trim()
      .toLowerCase()
      .replace(/[\s._-]+/g, "");
  for (const [canon, list] of Object.entries(HEADER_ALIASES)) {
    for (const alias of list) map.set(norm(alias), canon);
    map.set(norm(canon), canon);
  }
  return map;
})();

const normalizeBool = (v) => {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (["yes", "y", "true", "1"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return false;
};

const normalizeGender = (v) => {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (!s) return undefined;
  if (["m", "male"].includes(s)) return "male";
  if (["f", "female", "woman", "girl"].includes(s)) return "female";
  if (["o", "other", "others", "nonbinary", "non-binary", "nb"].includes(s))
    return "other";
  // anything else: keep undefined to trigger validation if required
  return s;
};

const normalizeBloodGroup = (v) => {
  if (!v && v !== 0) return "";
  let s = String(v).trim().toLowerCase();
  // common words -> symbols
  s = s
    .replace(/\bpositive\b/g, "+")
    .replace(/\bpos\b/g, "+")
    .replace(/\bnegative\b/g, "-")
    .replace(/\bneg\b/g, "-")
    .replace(/\s+/g, "");
  // standardize e.g. "a+" / "o-" / "ab+" (case-insensitive)
  const m = s.match(/^(a|b|ab|o)(\+|-)?$/i);
  if (m) return m[1].toUpperCase() + (m[2] || "").replace(" ", "");
  return s.toUpperCase();
};

const cleanPhone = (v) => {
  const digits = String(v ?? "").replace(/\D/g, "");
  return digits;
};

export async function importUsersFromExcel(req, res, next) {
  const cleanup = () => {
    if (req.file) fs.unlink(req.file.path, () => {});
  };

  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const wb = xlsx.readFile(req.file.path, { cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    let rows = xlsx.utils.sheet_to_json(ws, { defval: "", raw: true });

    const remapRow = (row) => {
      const out = {};
      const normKey = (k) =>
        String(k)
          .trim()
          .toLowerCase()
          .replace(/[\s._-]+/g, "");
      for (const [origK, val] of Object.entries(row)) {
        const canon = HEADER_CANON_LOOKUP.get(normKey(origK));
        if (canon) out[canon] = val;
        // unknown headers are ignored
      }
      return out;
    };
    rows = rows.map(remapRow);

    // check required headers
    const required = ["phone", "name", "bloodGroup"];
    const fileHeaders = rows.length ? Object.keys(rows[0]) : [];
    for (const r of required) {
      if (!fileHeaders.includes(r)) {
        cleanup();
        return res.status(400).json({
          message: `Your sheet is missing "${r}". 
          Required headers: "name", "phone", "blood group".`,
        });
      }
    }

    const toSet = new Set();
    const allPhones = rows.map((r) => cleanPhone(r.phone)).filter(Boolean);
    const existing = await UserModel.find(
      { phone: { $in: [...new Set(allPhones)] } },
      { phone: 1 }
    ).lean();
    const existingSet = new Set(existing.map((u) => cleanPhone(u.phone)));

    const isDate1904 = !!(
      wb.Workbook &&
      wb.Workbook.WBProps &&
      wb.Workbook.WBProps.date1904
    );
    const parseDate = (v) => {
      if (v == null || v === "") return undefined;

      // A) Excel serial number (best case)
      if (typeof v === "number") {
        const o = xlsx.SSF.parse_date_code(v, { date1904: isDate1904 });
        if (!o) return undefined;
        // 3) Store as UTC-midnight so the calendar day is stable everywhere
        return new Date(Date.UTC(o.y, o.m - 1, o.d));
        // If you prefer a pure date string, return:
        // return `${o.y}-${String(o.m).padStart(2,'0')}-${String(o.d).padStart(2,'0')}`;
      }

      // B) If something still came through as a JS Date (e.g., copied from Google Sheets)
      if (v instanceof Date && !isNaN(v)) {
        // Round to the nearest day in local time to kill 23:59:50 / 00:00:10 glitches
        const d2 = new Date(v.getTime() + 12 * 60 * 60 * 1000);
        return new Date(
          Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate())
        );
      }

      // C) If it's a string like "8/19/1990" or "1990-08-19" (fallback)
      const s = String(v).trim();

      // ISO YYYY-MM-DD
      const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (mIso) return new Date(Date.UTC(+mIso[1], +mIso[2] - 1, +mIso[3]));

      // mm/dd/yyyy or dd/mm/yyyy -> resolve by heuristics
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (m) {
        let [_, a, b, c] = m;
        const yy = +c;
        const year = c.length === 2 ? (yy < 50 ? 2000 + yy : 1900 + yy) : +c;
        let month, day;
        if (+a > 12) {
          day = +a;
          month = +b;
        } // dd/mm/yyyy
        else if (+b > 12) {
          month = +a;
          day = +b;
        } // mm/dd/yyyy
        else {
          month = +a;
          day = +b;
        } // default: mm/dd/yyyy
        return new Date(Date.UTC(year, month - 1, day));
      }

      return undefined;
    };

    const ops = [];
    const errors = [];
    let inserted = 0;
    let skippedExistingDB = 0;
    let skippedDuplicateInFile = 0;

    rows.forEach((r, i) => {
      const rowNum = i + 2;
      const phone = cleanPhone(r.phone);
      const name = String(r.name || "").trim();
      const bloodGroup = normalizeBloodGroup(r.bloodGroup);
      const address = String(r.address || "").trim() || undefined;
      const place = String(r.place || "").trim() || undefined;
      const dateOfBirth = parseDate(r.dateOfBirth);
      const gender = normalizeGender(r.gender);
      const isDonor = normalizeBool(r.isDonor);
      const lastDonationDate = parseDate(r.lastDonationDate);

      const rowErr = [];
      if (!name) rowErr.push("name is required");
      if (!phone) rowErr.push("phone is required");
      if (!bloodGroup || !VALID_BLOOD_GROUPS.includes(bloodGroup))
        rowErr.push("invalid blood group (use A+/A-/B+/B-/AB+/AB-/O+/O-)");
      if (gender && !VALID_GENDERS.includes(gender))
        rowErr.push("invalid gender (male/female/other)");

      if (rowErr.length) {
        errors.push({ row: rowNum, phone, errors: rowErr });
        return;
      }

      if (existingSet.has(phone)) {
        skippedExistingDB++;
        return;
      }
      if (toSet.has(phone)) {
        skippedDuplicateInFile++;
        return;
      }
      toSet.add(phone);

      const doc = {
        phone,
        name,
        address,
        place,
        dateOfBirth,
        gender: gender || undefined,
        bloodGroup,
        isDonor,
        lastDonationDate,
      };

      ops.push({ insertOne: { document: doc } });
    });

    if (ops.length) {
      const result = await UserModel.bulkWrite(ops, { ordered: false });
      inserted = result.insertedCount || 0;
    }

    cleanup();
    return res.status(200).json({
      message: "Import completed",
      summary: {
        totalRows: rows.length,
        inserted,
        skippedExistingDB,
        skippedDuplicateInFile,
        invalidRows: errors.length,
      },
      errors,
    });
  } catch (err) {
    try {
      if (req.file) fs.unlinkSync(req.file.path);
    } catch {}
    next(err);
  }
}

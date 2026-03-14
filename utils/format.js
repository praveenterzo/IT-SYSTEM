/**
 * utils/format.js — Shared data formatting helpers
 */

/**
 * Normalise a Mongoose document to a plain object with `id` string field.
 * Removes _id and __v from the output.
 */
function fmt(doc) {
  const o = doc.toObject ? doc.toObject({ virtuals: false }) : { ...doc };
  o.id = o._id.toString();
  if (o.assignedTo) o.assignedTo = o.assignedTo.toString();
  delete o._id;
  delete o.__v;
  return o;
}

/**
 * Build a field-level diff between two plain objects.
 * Returns an array of { field, oldValue, newValue } for changed fields only.
 */
function diffObjects(oldObj, newObj, fields) {
  const changes = [];
  for (const field of fields) {
    const o = String(oldObj[field] ?? '');
    const n = String(newObj[field] ?? '');
    if (o !== n) changes.push({ field, oldValue: o || '—', newValue: n || '—' });
  }
  return changes;
}

module.exports = { fmt, diffObjects };

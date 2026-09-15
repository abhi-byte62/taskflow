// Consistent success envelope.
//   { success: true, data: {...} }
// Failures use the error envelope produced by the error handler.

function success(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

module.exports = { success };
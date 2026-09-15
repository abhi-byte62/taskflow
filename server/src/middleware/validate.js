const { errors } = require('../errors');

// Validate req.body / req.params / req.query against a zod schema at the
// API boundary. Rejects before any service code runs.
//
//   router.post('/tasks', validate({ body: createTaskSchema }), handler)
//   router.get('/workspaces/:id', validate({ params: idSchema }), handler)
function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err.name === 'ZodError') {
        const details = {};
        for (const issue of err.issues) {
          const path = issue.path.join('.') || 'root';
          details[path] = issue.message;
        }
        return next(errors.validation(details));
      }
      next(err);
    }
  };
}

module.exports = { validate };
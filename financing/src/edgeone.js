import app from "./index.js";

export default function onRequest(context) {
  return app.fetch(context.request, context.env || {});
}

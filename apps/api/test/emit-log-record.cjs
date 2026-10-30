// Test-only preload: emits one log record through the global OpenTelemetry
// logs API once the tracing bootstrap has run, so a live logs pipeline would
// export it.
const { logs } = require("@opentelemetry/api");

setTimeout(() => {
  logs.getLogger("test").emit({ body: "log record" });
}, 0);

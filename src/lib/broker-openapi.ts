// OpenAPI 3.1 description of the broker integration API (/api/v1). Served at
// GET /api/v1/openapi.json so brokers can import it directly into Postman,
// Insomnia, Swagger UI, or a codegen tool.

export function buildOpenApiSpec(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Alternative Strategies — Engine API",
      version: "1.0.0",
      summary: "Pull AI trade signals scaled to your AUM, track allocations, and report executions.",
      description:
        "Broker integration API for the Alternative Strategies engine. Authenticate with a sandbox or live API key issued in your broker portal. The key selects the environment. All monetary values are Nigerian naira (fields suffixed _ngn). Simulated / illustrative — execution, custody and settlement are performed by the regulated broker.",
      contact: { name: "Alternative Strategies", url: `${origin}/strategies/api-docs` },
    },
    servers: [
      { url: `${origin}/api/v1`, description: "This deployment" },
      { url: "/api/v1", description: "Relative to your host" },
    ],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Account", description: "Your account and allocation." },
      { name: "Signals", description: "Orders to execute." },
      { name: "Transactions", description: "Allocated orders and P&L." },
      { name: "Execution", description: "Report fills back to the engine." },
    ],
    paths: {
      "/account": {
        get: {
          tags: ["Account"],
          summary: "Get account & allocation",
          description: "The authenticated broker's account, environment and how the AUM deploys across cadences.",
          responses: {
            "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/AccountResponse" } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/signals": {
        get: {
          tags: ["Signals"],
          summary: "List open signals",
          description: "The open orders the engine has allocated to you, scaled to your AUM — the instructions to execute now.",
          responses: {
            "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/SignalsResponse" } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/transactions": {
        get: {
          tags: ["Transactions"],
          summary: "List transactions",
          description: "Every order allocated to you — open and closed — with realised P&L, for the key's environment.",
          responses: {
            "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/TransactionsResponse" } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/execution-reports": {
        post: {
          tags: ["Execution"],
          summary: "Report an execution",
          description: "Report what happened to an allocated order, referenced by clientOrderId.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ExecutionReportRequest" } } },
          },
          responses: {
            "200": { description: "Recorded", content: { "application/json": { schema: { $ref: "#/components/schemas/ExecutionReportResponse" } } } },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
            "422": { $ref: "#/components/responses/Unprocessable" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Your API key from the broker portal. Prefix sk_sandbox_ (test) or sk_live_ (production).",
        },
      },
      responses: {
        Unauthorized: { description: "Missing or invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        BadRequest: { description: "Malformed request", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        NotFound: { description: "Referenced order not found in this environment", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        Unprocessable: { description: "Unsupported value", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      },
      schemas: {
        Error: {
          type: "object",
          properties: { ok: { type: "boolean", const: false }, error: { type: "string" } },
          required: ["ok", "error"],
        },
        Allocation: {
          type: "object",
          properties: { intraday: { type: "number" }, weekly: { type: "number" }, monthly: { type: "number" } },
        },
        AccountResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            account: {
              type: "object",
              properties: {
                firm: { type: "string" },
                mode: { type: "string", enum: ["sandbox", "live"] },
                aum_ngn: { type: "number" },
                status: { type: "string", enum: ["active", "suspended"] },
                engine_model_capital_ngn: { type: "number" },
                allocation: { $ref: "#/components/schemas/Allocation" },
                risk: {
                  type: "object",
                  properties: {
                    max_position_pct: { type: "number" },
                    max_pct_daily_volume: { type: "number" },
                    stop_loss_pct: { type: "number" },
                    drawdown_halt_pct: { type: "number" },
                    fx_overlay: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
        Signal: {
          type: "object",
          properties: {
            clientOrderId: { type: "string", description: "Stable, idempotent order id." },
            side: { type: "string", enum: ["BUY", "SELL"] },
            symbol: { type: "string", description: "NGX ticker." },
            quantity: { type: "integer" },
            notional_ngn: { type: "number" },
            referencePrice: { type: "number" },
            weightPct: { type: "number" },
            tenure: { type: "string", enum: ["INTRADAY", "WEEKLY", "MONTHLY"] },
            factors: { type: ["object", "null"], additionalProperties: { type: "number" } },
            brokerStatus: { type: "string", enum: ["allocated", "acknowledged", "filled", "rejected", "cancelled"] },
          },
        },
        SignalsResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            mode: { type: "string", enum: ["sandbox", "live"] },
            count: { type: "integer" },
            signals: { type: "array", items: { $ref: "#/components/schemas/Signal" } },
          },
        },
        Transaction: {
          type: "object",
          properties: {
            clientOrderId: { type: "string" },
            side: { type: "string" },
            symbol: { type: "string" },
            company: { type: "string" },
            tenure: { type: "string" },
            quantity: { type: "integer" },
            entryPrice: { type: "number" },
            notional_ngn: { type: "number" },
            status: { type: "string", enum: ["open", "closed"] },
            brokerStatus: { type: "string" },
            closePrice: { type: ["number", "null"] },
            realizedPnl_ngn: { type: ["number", "null"] },
            openedAt: { type: "string", format: "date-time" },
            closedAt: { type: ["string", "null"], format: "date-time" },
          },
        },
        TransactionsResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            mode: { type: "string", enum: ["sandbox", "live"] },
            count: { type: "integer" },
            transactions: { type: "array", items: { $ref: "#/components/schemas/Transaction" } },
          },
        },
        ExecutionReportRequest: {
          type: "object",
          required: ["clientOrderId", "status"],
          properties: {
            clientOrderId: { type: "string", description: "The order id from /signals." },
            status: { type: "string", enum: ["acknowledged", "filled", "rejected", "cancelled"] },
          },
        },
        ExecutionReportResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            clientOrderId: { type: "string" },
            recorded: { type: "string" },
            order: {
              type: "object",
              properties: { symbol: { type: "string" }, quantity: { type: "integer" }, brokerStatus: { type: "string" } },
            },
          },
        },
      },
    },
  };
}

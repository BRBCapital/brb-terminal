// swagger-ui-react ships no types. Minimal ambient declaration so it can be
// dynamically imported and given the props Swagger UI accepts (url, layout,
// docExpansion, tryItOutEnabled, …).
declare module "swagger-ui-react" {
  import type { ComponentType } from "react";
  const SwaggerUI: ComponentType<Record<string, unknown>>;
  export default SwaggerUI;
}

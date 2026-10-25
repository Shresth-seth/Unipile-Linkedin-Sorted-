import * as esbuild from "esbuild";
import * as acorn from "acorn";
import * as walk from "acorn-walk";
import fs from "node:fs";
import path from "node:path";

const serverDir = path.resolve(process.cwd());
const routesDir = path.join(serverDir, "src", "routes");
const appPath = path.join(serverDir, "src", "app.ts");

interface DeclaredCall {
  file: string;
  line: number;
  routerVar: string;
  method: string;
  paths: string[];
  middlewareCount: number;
  chainedFrom?: string;
}

interface MountCall {
  file: string;
  line: number;
  prefixes: string[];
  routerVar: string;
  sourceFile?: string | undefined;
}

function parseAstFromFile(filePath: string) {
  const tsCode = fs.readFileSync(filePath, "utf-8");
  // Transform TS to JS with source mapping locations preserved
  const js = esbuild.transformSync(tsCode, { loader: "ts" }).code;
  const ast = acorn.parse(js, { ecmaVersion: "latest", sourceType: "module", locations: true });
  return { ast, tsCode };
}

function extractStringOrArray(node: any): string[] {
  if (!node) return [];
  if (node.type === "Literal" && typeof node.value === "string") {
    return [node.value];
  }
  if (node.type === "TemplateLiteral" && node.quasis.length === 1 && node.expressions.length === 0) {
    return [node.quasis[0].value.raw];
  }
  if (node.type === "ArrayExpression") {
    const paths: string[] = [];
    for (const elem of node.elements) {
      if (elem?.type === "Literal" && typeof elem.value === "string") {
        paths.push(elem.value);
      } else if (elem?.type === "TemplateLiteral" && elem.quasis.length === 1 && elem.expressions.length === 0) {
        paths.push(elem.quasis[0].value.raw);
      }
    }
    return paths;
  }
  return [];
}

// 1. Parse server/src/app.ts
const { ast: appAst } = parseAstFromFile(appPath);

const routerImportMap: Record<string, string> = {};
const appDirectCalls: DeclaredCall[] = [];
const appMounts: MountCall[] = [];

// First pass: imports
walk.simple(appAst, {
  ImportDeclaration(node: any) {
    const source = node.source.value;
    for (const spec of node.specifiers) {
      if (spec.type === "ImportDefaultSpecifier") {
        routerImportMap[spec.local.name] = source;
      }
    }
  },
});

// Second pass: app.use and direct app.<method>
const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "all"]);

walk.simple(appAst, {
  CallExpression(node: any) {
    const callee = node.callee;
    if (callee.type === "MemberExpression" && callee.object.type === "Identifier" && callee.object.name === "app") {
      const prop = callee.property.name;
      const line = node.loc.start.line;

      if (prop === "use") {
        if (node.arguments.length >= 2) {
          const firstArg = node.arguments[0];
          const secondArg = node.arguments[1];
          const prefixes = extractStringOrArray(firstArg);
          if (secondArg.type === "Identifier" && prefixes.length > 0) {
            const routerVar = secondArg.name;
            const sourceFile = routerImportMap[routerVar];
            appMounts.push({
              file: "server/src/app.ts",
              line,
              prefixes,
              routerVar,
              sourceFile,
            });
          }
        }
      } else if (HTTP_METHODS.has(prop.toLowerCase())) {
        if (node.arguments.length >= 2) {
          const firstArg = node.arguments[0];
          const paths = extractStringOrArray(firstArg);
          if (paths.length > 0) {
            appDirectCalls.push({
              file: "server/src/app.ts",
              line,
              routerVar: "app",
              method: prop.toUpperCase(),
              paths,
              middlewareCount: node.arguments.length - 1,
            });
          }
        }
      }
    }
  },
});

// 2. Parse all route files in server/src/routes/*.ts
const routeFileNames = fs.readdirSync(routesDir).filter((f) => f.endsWith(".ts")).sort();
const routerCallsByFile: Record<string, DeclaredCall[]> = {};

for (const fname of routeFileNames) {
  const fpath = path.join(routesDir, fname);
  const { ast } = parseAstFromFile(fpath);
  const calls: DeclaredCall[] = [];

  walk.simple(ast, {
    CallExpression(node: any) {
      const callee = node.callee;

      // Pattern 1: router.<method>(path, ...handlers)
      if (callee.type === "MemberExpression") {
        const method = callee.property.name?.toLowerCase();
        if (HTTP_METHODS.has(method)) {
          // Direct router.<method>
          if (callee.object.type === "Identifier" && callee.object.name === "router") {
            const line = node.loc.start.line;
            if (node.arguments.length >= 1) {
              const paths = extractStringOrArray(node.arguments[0]);
              if (paths.length > 0) {
                calls.push({
                  file: `server/src/routes/${fname}`,
                  line,
                  routerVar: "router",
                  method: method.toUpperCase(),
                  paths,
                  middlewareCount: node.arguments.length - 1,
                });
              }
            }
          }
          // Chained: router.route('/path').get(...).post(...)
          else if (callee.object.type === "CallExpression") {
            let innerCall = callee.object;
            while (innerCall && innerCall.type === "CallExpression") {
              const innerCallee = innerCall.callee;
              if (innerCallee.type === "MemberExpression" && innerCallee.property.name === "route") {
                const paths = extractStringOrArray(innerCall.arguments[0]);
                const line = node.loc.start.line;
                if (paths.length > 0) {
                  calls.push({
                    file: `server/src/routes/${fname}`,
                    line,
                    routerVar: "router",
                    method: method.toUpperCase(),
                    paths,
                    middlewareCount: node.arguments.length,
                    chainedFrom: "router.route",
                  });
                }
                break;
              }
              innerCall = innerCallee.object;
            }
          }
        }
      }
    },
  });

  routerCallsByFile[fname] = calls;
}

// 3. Output Synthesized AST Report
console.log("================================================================================");
console.log("WORKPILOT OFFICIAL ESTREE AST ROUTE & ENDPOINT INVENTORY");
console.log("AST Engine: esbuild TS Desugaring + Acorn ESTree Parser + Acorn-Walk AST Traversal");
console.log(`Routes Directory: ${routesDir}`);
console.log(`Application Host: ${appPath}`);
console.log("================================================================================\n");

console.log("--- PART 1: Express Router Mount Declarations in server/src/app.ts ---");
console.log(`Total Router Mount Calls: ${appMounts.length}\n`);

const mountsByFile: Record<string, string[]> = {};
for (const mount of appMounts) {
  const normModule = mount.sourceFile?.replace("./routes/", "").replace(".js", ".ts") || mount.routerVar;
  if (!mountsByFile[normModule]) {
    mountsByFile[normModule] = [];
  }
  for (const p of mount.prefixes) {
    mountsByFile[normModule].push(p);
  }
  console.log(`  Line ${String(mount.line).padStart(3)}: app.use("${mount.prefixes.join('", "')}", ${mount.routerVar}) -> ${normModule}`);
}

console.log("\n--- PART 2: Declared Route Handlers by Route File (AST CallExpressions) ---");
let totalRouteCallExpressions = 0;
let totalDeclaredEndpointsInRoutes = 0;

interface FlattenedEndpoint {
  file: string;
  line: number;
  method: string;
  path: string;
  middlewareCount: number;
  chainedFrom?: string | undefined;
}

const allDeclaredEndpoints: FlattenedEndpoint[] = [];

for (const [fname, calls] of Object.entries(routerCallsByFile)) {
  let fileEndpoints = 0;
  for (const c of calls) {
    for (const p of c.paths) {
      fileEndpoints++;
      allDeclaredEndpoints.push({
        file: c.file,
        line: c.line,
        method: c.method,
        path: p,
        middlewareCount: c.middlewareCount,
        chainedFrom: c.chainedFrom,
      });
    }
  }
  totalRouteCallExpressions += calls.length;
  totalDeclaredEndpointsInRoutes += fileEndpoints;
  console.log(`  ${fname.padEnd(25)}: ${String(calls.length).padStart(3)} CallExpressions -> ${String(fileEndpoints).padStart(3)} (Method, Path) endpoints`);
}

console.log(`\nSubtotal Route Files: ${totalRouteCallExpressions} CallExpressions declaring ${totalDeclaredEndpointsInRoutes} (Method, Path) endpoints across ${routeFileNames.length} files.`);

console.log("\n--- PART 3: Direct App Route Declarations in server/src/app.ts ---");
let totalDirectAppEndpoints = 0;
const appDirectEndpoints: FlattenedEndpoint[] = [];

for (const c of appDirectCalls) {
  for (const p of c.paths) {
    totalDirectAppEndpoints++;
    appDirectEndpoints.push({
      file: c.file,
      line: c.line,
      method: c.method,
      path: p,
      middlewareCount: c.middlewareCount,
    });
    console.log(`  Line ${String(c.line).padStart(3)}: ${c.method} ${p} (${c.middlewareCount} handlers/middlewares)`);
  }
}
console.log(`Subtotal Direct App Endpoints: ${appDirectCalls.length} CallExpressions declaring ${totalDirectAppEndpoints} endpoints.`);

console.log("\n--- PART 4: Reachable HTTP URLs (Resolving Mount Prefixes & Mount Aliases) ---");

interface ReachableURL {
  method: string;
  url: string;
  declaredFile: string;
  declaredLine: number;
  mountPrefix: string;
  isAlias: boolean;
  notes?: string;
}

const reachableUrls: ReachableURL[] = [];

// Direct app endpoints
for (const d of appDirectEndpoints) {
  reachableUrls.push({
    method: d.method,
    url: d.path,
    declaredFile: d.file,
    declaredLine: d.line,
    mountPrefix: "[direct]",
    isAlias: false,
    notes: "Direct Express app handler",
  });
}

// Mounted endpoints
let primaryEndpointCount = 0;
let aliasEndpointCount = 0;

for (const [fname, calls] of Object.entries(routerCallsByFile)) {
  const mounts = mountsByFile[fname] || ["/api"];
  const primaryMount = mounts[0] || "/api";
  const aliasMounts = mounts.slice(1);

  for (const c of calls) {
    for (const p of c.paths) {
      let primaryUrl: string;
      if (primaryMount === "/api") {
        primaryUrl = p.startsWith("/") ? `/api${p}` : `/api/${p}`;
      } else if (p === "/" || p === "") {
        primaryUrl = primaryMount;
      } else {
        primaryUrl = `${primaryMount}${p.startsWith("/") ? p : "/" + p}`;
      }

      primaryEndpointCount++;
      reachableUrls.push({
        method: c.method,
        url: primaryUrl,
        declaredFile: c.file,
        declaredLine: c.line,
        mountPrefix: primaryMount,
        isAlias: false,
      });

      for (const aliasMount of aliasMounts) {
        let aliasUrl: string;
        if (p === "/" || p === "") {
          aliasUrl = aliasMount;
        } else {
          aliasUrl = `${aliasMount}${p.startsWith("/") ? p : "/" + p}`;
        }
        aliasEndpointCount++;
        reachableUrls.push({
          method: c.method,
          url: aliasUrl,
          declaredFile: c.file,
          declaredLine: c.line,
          mountPrefix: aliasMount,
          isAlias: true,
          notes: `Mount alias of ${primaryUrl}`,
        });
      }
    }
  }
}

console.log(`Reachable URL Breakdown:`);
console.log(`  1. Direct Express App Endpoints:   ${String(totalDirectAppEndpoints).padStart(3)}`);
console.log(`  2. Primary Mounted Endpoints:     ${String(primaryEndpointCount).padStart(3)}`);
console.log(`  3. Mount Alias Endpoints:          ${String(aliasEndpointCount).padStart(3)}`);
console.log(`  -----------------------------------------`);
console.log(`  Total Reachable HTTP API URLs:    ${String(reachableUrls.length).padStart(3)}\n`);

console.log("--- PART 5: Route Shadowing & Ambiguity Analysis ---");

const urlCollisions: Record<string, ReachableURL[]> = {};
for (const r of reachableUrls) {
  const key = `${r.method} ${r.url}`;
  if (!urlCollisions[key]) urlCollisions[key] = [];
  urlCollisions[key].push(r);
}

const duplicates = Object.entries(urlCollisions).filter(([_, list]) => list.length > 1);
if (duplicates.length > 0) {
  console.log(`⚠️  Detected ${duplicates.length} Shadowed / Overlapping Route Registrations:\n`);
  for (const [key, list] of duplicates) {
    console.log(`  - [OVERLAP] ${key}:`);
    for (const item of list) {
      console.log(`      Defined at ${item.declaredFile}:${item.declaredLine} (Mount: ${item.mountPrefix}, Alias: ${item.isAlias})`);
    }
    console.log(`      Runtime Resolution: Express executes middleware sequentially in registration order.`);
    console.log(`      The route registered first in app.ts will handle the request; later registrations are shadowed.\n`);
  }
} else {
  console.log("No overlapping or shadowed routes detected.");
}

console.log("================================================================================");
console.log("FINAL AUTHORITATIVE AST AUDIT TOTALS:");
console.log(`  1. AST Route CallExpressions in routes/:      ${totalRouteCallExpressions}`);
console.log(`  2. Declared (Method, Path) pairs in routes/:  ${totalDeclaredEndpointsInRoutes}`);
console.log(`  3. Direct App Endpoints in app.ts:            ${totalDirectAppEndpoints} (across ${appDirectCalls.length} CallExpressions)`);
console.log(`  4. Total Unique Route Implementations:        ${totalDeclaredEndpointsInRoutes + totalDirectAppEndpoints}`);
console.log(`  5. Total Mount Aliases:                       ${aliasEndpointCount}`);
console.log(`  6. Total Reachable HTTP API Endpoints:        ${reachableUrls.length}`);
console.log("================================================================================\n");

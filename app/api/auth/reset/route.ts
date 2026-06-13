import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const diagnosticPrefix = "[PASSWORD-RESET-DIAGNOSTIC]";

console.log(`${diagnosticPrefix} module loaded`);

type ResetBody = {
  email?: unknown;
};

type ResetEnv = {
  appwriteEndpoint: string;
  appwriteProjectId: string;
  appwriteProjectIdSource: "APPWRITE_PROJECT_ID" | "NEXT_PUBLIC_APPWRITE_PROJECT_ID";
  redirectUrl: string;
};

function emailDomainOnly(email: string) {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  return domain || "unknown";
}

function safeErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error || "Unknown error") };
  }

  const candidate = error as {
    code?: unknown;
    type?: unknown;
    message?: unknown;
    stack?: unknown;
  };

  return {
    code: typeof candidate.code === "number" || typeof candidate.code === "string" ? candidate.code : undefined,
    type: typeof candidate.type === "string" ? candidate.type : undefined,
    message: typeof candidate.message === "string" ? candidate.message : "Unknown error",
    stack: typeof candidate.stack === "string" ? candidate.stack.split("\n").slice(0, 3).join("\n") : undefined
  };
}

function safeDiagnosticMessage(error: unknown) {
  const details = safeErrorDetails(error);
  return details.message || "unknown_error";
}

function normaliseBaseUrl(value: string | undefined, fallback = "https://getcontentos.co") {
  const candidate = value?.trim() || fallback;

  try {
    return new URL(candidate).toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function readResetEnv(): ResetEnv | null {
  const appwriteEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT?.trim() || "";
  const serverProjectId = process.env.APPWRITE_PROJECT_ID?.trim() || "";
  const publicProjectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim() || "";
  const appwriteProjectId = serverProjectId || publicProjectId;
  const appwriteProjectIdSource = serverProjectId ? "APPWRITE_PROJECT_ID" : "NEXT_PUBLIC_APPWRITE_PROJECT_ID";
  const appUrl = normaliseBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  const siteUrl = normaliseBaseUrl(process.env.NEXT_PUBLIC_SITE_URL, appUrl);

  if (!appwriteEndpoint || !appwriteProjectId) {
    return null;
  }

  return {
    appwriteEndpoint,
    appwriteProjectId,
    appwriteProjectIdSource,
    redirectUrl: new URL("/reset-password", siteUrl).toString()
  };
}

export async function POST(request: Request) {
  try {
    console.log(`${diagnosticPrefix} step 1 route called`);

    let resetEnv: ResetEnv | null = null;
    try {
      console.log(`${diagnosticPrefix} step 1a before env read`);
      resetEnv = readResetEnv();
      console.log(`${diagnosticPrefix} step 1b after env read`, {
        configured: Boolean(resetEnv),
        appwriteProjectId: resetEnv?.appwriteProjectId ?? "missing",
        appwriteProjectIdSource: resetEnv?.appwriteProjectIdSource ?? "missing",
        expectedAppwriteProjectId: "6a2a6be900011401e963",
        redirectUrl: resetEnv?.redirectUrl ?? "missing"
      });
    } catch (error) {
      const details = safeErrorDetails(error);
      console.error(`${diagnosticPrefix} stop at env read`, {
        file: "app/api/auth/reset/route.ts",
        functionName: "readResetEnv",
        message: details.message,
        stack: details.stack
      });

      return NextResponse.json(
        { success: false, diagnostic: "env_missing" },
        { status: 500 }
      );
    }

    if (!resetEnv) {
      console.error(`${diagnosticPrefix} stop at env validation`, {
        file: "app/api/auth/reset/route.ts",
        functionName: "readResetEnv",
        diagnostic: "env_missing"
      });

      return NextResponse.json(
        { success: false, diagnostic: "env_missing" },
        { status: 503 }
      );
    }

    let body: ResetBody;
    try {
      console.log(`${diagnosticPrefix} step 2a before request.json`);
      body = (await request.json()) as ResetBody;
      console.log(`${diagnosticPrefix} step 2 request parsed`, {
        hasEmail: typeof body.email === "string",
        emailDomain: typeof body.email === "string" ? emailDomainOnly(body.email) : "missing"
      });
    } catch (error) {
      const details = safeErrorDetails(error);
      console.error(`${diagnosticPrefix} stop at request.json`, {
        file: "app/api/auth/reset/route.ts",
        functionName: "request.json",
        message: details.message,
        stack: details.stack
      });

      return NextResponse.json(
        { success: false, diagnostic: "request_json_failed" },
        { status: 400 }
      );
    }

    let email = "";
    try {
      console.log(`${diagnosticPrefix} step 2b before validation`);
      email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

      if (!email || !email.includes("@")) {
        console.warn(`${diagnosticPrefix} stop at validation`, {
          file: "app/api/auth/reset/route.ts",
          functionName: "email validation",
          diagnostic: "validation_failed"
        });

        return NextResponse.json(
          { success: false, diagnostic: "validation_failed" },
          { status: 400 }
        );
      }

      console.log(`${diagnosticPrefix} step 2c validation passed`, {
        emailDomain: emailDomainOnly(email)
      });
    } catch (error) {
      const details = safeErrorDetails(error);
      console.error(`${diagnosticPrefix} stop at validation exception`, {
        file: "app/api/auth/reset/route.ts",
        functionName: "email validation",
        message: details.message,
        stack: details.stack
      });

      return NextResponse.json(
        { success: false, diagnostic: "validation_failed" },
        { status: 400 }
      );
    }

    try {
      console.log(`${diagnosticPrefix} step 3 recovery request prepared`, {
        emailDomain: emailDomainOnly(email),
        redirectUrl: resetEnv.redirectUrl,
        expectedProductionRedirectUrl: "https://getcontentos.co/reset-password"
      });

      console.log(`${diagnosticPrefix} step 4a before node-appwrite import`, {
        emailDomain: emailDomainOnly(email),
        redirectUrl: resetEnv.redirectUrl
      });
      const { Account, Client } = await import("node-appwrite");

      console.log(`${diagnosticPrefix} step 4b before Appwrite client creation`, {
        emailDomain: emailDomainOnly(email),
        appwriteProjectId: resetEnv.appwriteProjectId,
        appwriteProjectIdSource: resetEnv.appwriteProjectIdSource,
        expectedAppwriteProjectId: "6a2a6be900011401e963",
        redirectUrl: resetEnv.redirectUrl
      });
      const client = new Client()
        .setEndpoint(resetEnv.appwriteEndpoint)
        .setProject(resetEnv.appwriteProjectId);
      const account = new Account(client);

      console.log(`${diagnosticPrefix} step 4 before createRecovery`, {
        emailDomain: emailDomainOnly(email),
        appwriteProjectId: resetEnv.appwriteProjectId,
        appwriteProjectIdSource: resetEnv.appwriteProjectIdSource,
        endpoint: resetEnv.appwriteEndpoint,
        hasServerProjectId: Boolean(process.env.APPWRITE_PROJECT_ID?.trim()),
        hasPublicProjectId: Boolean(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim()),
        expectedAppwriteProjectId: "6a2a6be900011401e963",
        redirectUrl: resetEnv.redirectUrl
      });

      await account.createRecovery({
        email,
        url: resetEnv.redirectUrl
      });

      console.log(`${diagnosticPrefix} step 5 after createRecovery`, {
        emailDomain: emailDomainOnly(email),
        redirectUrl: resetEnv.redirectUrl
      });

      return NextResponse.json({
        success: true,
        diagnostic: "createRecovery succeeded"
      });
    } catch (error) {
      const details = safeErrorDetails(error);
      const diagnostic = details.message || "createRecovery failed";

      console.error(`${diagnosticPrefix} step 6 catch createRecovery failed`, {
        file: "app/api/auth/reset/route.ts",
        functionName: "node-appwrite import/Appwrite client/createRecovery",
        emailDomain: emailDomainOnly(email),
        redirectUrl: resetEnv.redirectUrl,
        appwriteProjectId: resetEnv.appwriteProjectId,
        appwriteProjectIdSource: resetEnv.appwriteProjectIdSource,
        expectedAppwriteProjectId: "6a2a6be900011401e963",
        appwriteCode: details.code,
        appwriteType: details.type,
        appwriteMessage: details.message,
        stack: details.stack
      });

      return NextResponse.json(
        {
          success: false,
          diagnostic
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const details = safeErrorDetails(error);
    console.error(`${diagnosticPrefix} fatal error`, {
      file: "app/api/auth/reset/route.ts",
      functionName: "POST",
      message: details.message,
      stack: details.stack
    });

    return NextResponse.json(
      {
        success: false,
        diagnostic: safeDiagnosticMessage(error)
      },
      { status: 500 }
    );
  }
}

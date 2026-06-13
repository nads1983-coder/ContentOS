import { NextResponse } from "next/server";
import { createAppwriteAccountClient } from "@/lib/appwrite";
import { isAppwriteConfigured } from "@/lib/env";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const diagnosticPrefix = "[PASSWORD-RESET-DIAGNOSTIC]";

type ResetBody = {
  email?: unknown;
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
    stack: typeof candidate.stack === "string" ? candidate.stack.split("\n").slice(0, 2).join("\n") : undefined
  };
}

function safeDiagnosticMessage(error: unknown) {
  const details = safeErrorDetails(error);
  return details.message || "unknown_error";
}

export async function POST(request: Request) {
  console.log(`${diagnosticPrefix} step 1 route called`);

  let configured = false;
  try {
    console.log(`${diagnosticPrefix} step 1a before isAppwriteConfigured`);
    configured = isAppwriteConfigured();
    console.log(`${diagnosticPrefix} step 1b after isAppwriteConfigured`, { configured });
  } catch (error) {
    const details = safeErrorDetails(error);
    console.error(`${diagnosticPrefix} stop at isAppwriteConfigured`, {
      functionName: "isAppwriteConfigured",
      appwriteCode: details.code,
      appwriteType: details.type,
      message: details.message,
      stack: details.stack
    });

    return NextResponse.json(
      { success: false, diagnostic: "env_missing" },
      { status: 500 }
    );
  }

  if (!configured) {
    console.error(`${diagnosticPrefix} stop at env validation`, {
      functionName: "isAppwriteConfigured",
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
      functionName: "email validation",
      message: details.message,
      stack: details.stack
    });

    return NextResponse.json(
      { success: false, diagnostic: "validation_failed" },
      { status: 400 }
    );
  }

  let redirectUrl = "";
  try {
    console.log(`${diagnosticPrefix} step 3a before absoluteUrl`);
    redirectUrl = absoluteUrl("/reset-password");
    console.log(`${diagnosticPrefix} step 3 recovery request prepared`, {
      emailDomain: emailDomainOnly(email),
      redirectUrl,
      expectedProductionRedirectUrl: "https://getcontentos.co/reset-password"
    });
  } catch (error) {
    const details = safeErrorDetails(error);
    console.error(`${diagnosticPrefix} stop at absoluteUrl`, {
      functionName: "absoluteUrl",
      message: details.message,
      stack: details.stack
    });

    return NextResponse.json(
      { success: false, diagnostic: safeDiagnosticMessage(error) },
      { status: 500 }
    );
  }

  try {
    console.log(`${diagnosticPrefix} step 4a before createAppwriteAccountClient`, {
      emailDomain: emailDomainOnly(email),
      redirectUrl
    });
    const { account } = createAppwriteAccountClient();
    console.log(`${diagnosticPrefix} step 4 before createRecovery`, {
      emailDomain: emailDomainOnly(email),
      redirectUrl
    });

    await account.createRecovery({
      email,
      url: redirectUrl
    });

    console.log(`${diagnosticPrefix} step 5 after createRecovery`, {
      emailDomain: emailDomainOnly(email),
      redirectUrl
    });

    return NextResponse.json({
      success: true,
      diagnostic: "createRecovery succeeded"
    });
  } catch (error) {
    const details = safeErrorDetails(error);
    const diagnostic = details.message || "createRecovery failed";

    console.error(`${diagnosticPrefix} step 6 catch createRecovery failed`, {
      functionName: "createAppwriteAccountClient/createRecovery",
      emailDomain: emailDomainOnly(email),
      redirectUrl,
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
}

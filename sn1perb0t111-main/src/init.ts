// Global fetch interceptor to inject auth token
const originalFetch = window.fetch;

console.log("🚀 [CSFloat Sniper] Global fetch interceptor loaded and active!");

let isVerifyingToken = false;

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let url = "";
  if (typeof input === "string") {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input && typeof input === "object" && "url" in input) {
    url = (input as any).url;
  }

  let sentToken = false;
  let requestToken: string | null = null;

  // Only intercept API calls and exclude login route
  if (url.includes("/api/") && !url.includes("/api/auth/login")) {
    const token = localStorage.getItem("auth_token");
    console.log(`🔍 [CSFloat Sniper] Intercepted fetch to: ${url}. Token found: ${!!token}`);
    if (token) {
      requestToken = token;
      
      // Handle when input is a Request object
      if (input && typeof input === "object" && !(input instanceof URL)) {
        const req = input as Request;
        const newHeaders = new Headers(req.headers);
        newHeaders.set("Authorization", `Bearer ${token}`);
        
        // Clone the request with the new headers
        input = new Request(req, {
          headers: newHeaders,
          // Merge init options if they exist
          ...(init || {})
        });
        sentToken = true;
      } else {
        // Handle when input is a string or URL
        init = init || {};
        const newHeaders = new Headers(init.headers || {});
        newHeaders.set("Authorization", `Bearer ${token}`);
        init.headers = newHeaders;
        sentToken = true;
      }
    }
  }

  const response = await originalFetch(input, init);

  if (
    response.status === 401 &&
    !url.includes("/api/auth/login") &&
    !url.includes("/api/auth/status") &&
    !isVerifyingToken
  ) {
    if (!sentToken) {
      localStorage.removeItem("auth_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    } else {
      const currentToken = localStorage.getItem("auth_token");
      if (currentToken === requestToken) {
        // Verify with /api/auth/status before logging out
        // to avoid false logouts from race conditions on page load
        isVerifyingToken = true;
        try {
          const statusRes = await originalFetch("/api/auth/status", {
            headers: { "Authorization": `Bearer ${currentToken}` },
          });
          if (statusRes.status === 401) {
            localStorage.removeItem("auth_token");
            if (window.location.pathname !== "/login") {
              window.location.href = "/login";
            }
          } else if (statusRes.ok) {
            const data = await statusRes.json();
            if (!data.authenticated) {
              localStorage.removeItem("auth_token");
              if (window.location.pathname !== "/login") {
                window.location.href = "/login";
              }
            }
          }
        } catch {
          // Network error — don't log out, server might be temporarily unavailable
        } finally {
          isVerifyingToken = false;
        }
      }
    }
  }

  return response;
};

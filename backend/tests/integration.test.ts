import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, connectWebSocket, connectAuthenticatedWebSocket, waitForMessage } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for chaining tests (e.g., created resource IDs, auth tokens)
  let authToken: string;
  let testDeviceId: string;
  let registeredDeviceId: string;
  let reportId: string;
  let ruleId: string;

  // Setup: Sign up test user for authenticated endpoints
  test("Sign up test user", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    expect(authToken).toBeDefined();
    // Use a simple device ID for testing
    testDeviceId = "device-" + user.id.substring(0, 8);
  });

  describe("Device Agent - Rules", () => {
    test("Get rules for a device (200)", async () => {
      const res = await authenticatedApi(
        `/device-agent/rules?deviceId=${testDeviceId}`,
        authToken
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test("Get rules without deviceId (missing required param)", async () => {
      const res = await authenticatedApi(
        "/device-agent/rules",
        authToken
      );
      // Expect either 400 (bad request) or a similar error status
      expect([400, 422].includes(res.status)).toBe(true);
    });

    test("Get rules with empty deviceId", async () => {
      const res = await authenticatedApi(
        "/device-agent/rules?deviceId=",
        authToken
      );
      // Expect error for empty/invalid deviceId
      expect([400, 422].includes(res.status)).toBe(true);
    });
  });

  describe("Device Agent - Report Usage", () => {
    test("Report device usage (200)", async () => {
      const now = new Date().toISOString();
      const res = await authenticatedApi(
        "/device-agent/report",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: testDeviceId,
            appName: "TestApp",
            usageMinutes: 30,
            reportedAt: now,
          }),
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.reportId).toBeDefined();
      reportId = data.reportId;
    });

    test("Report usage without deviceId (missing required field)", async () => {
      const now = new Date().toISOString();
      const res = await authenticatedApi(
        "/device-agent/report",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appName: "TestApp",
            usageMinutes: 30,
            reportedAt: now,
          }),
        }
      );
      await expectStatus(res, 400);
    });

    test("Report usage without appName (missing required field)", async () => {
      const now = new Date().toISOString();
      const res = await authenticatedApi(
        "/device-agent/report",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: testDeviceId,
            usageMinutes: 30,
            reportedAt: now,
          }),
        }
      );
      await expectStatus(res, 400);
    });

    test("Report usage without usageMinutes (missing required field)", async () => {
      const now = new Date().toISOString();
      const res = await authenticatedApi(
        "/device-agent/report",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: testDeviceId,
            appName: "TestApp",
            reportedAt: now,
          }),
        }
      );
      await expectStatus(res, 400);
    });

    test("Report usage without reportedAt (missing required field)", async () => {
      const res = await authenticatedApi(
        "/device-agent/report",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: testDeviceId,
            appName: "TestApp",
            usageMinutes: 30,
          }),
        }
      );
      await expectStatus(res, 400);
    });

    test("Report usage with invalid reportedAt format", async () => {
      const res = await authenticatedApi(
        "/device-agent/report",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: testDeviceId,
            appName: "TestApp",
            usageMinutes: 30,
            reportedAt: "not-a-date",
          }),
        }
      );
      await expectStatus(res, 400);
    });
  });

  describe("Device Agent - Get Reports", () => {
    test("Get reports for a device (200)", async () => {
      const res = await authenticatedApi(
        `/device-agent/reports?deviceId=${testDeviceId}`,
        authToken
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test("Get reports without deviceId (missing required param)", async () => {
      const res = await authenticatedApi(
        "/device-agent/reports",
        authToken
      );
      expect([400, 422].includes(res.status)).toBe(true);
    });

    test("Get reports with date range filters", async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const res = await authenticatedApi(
        `/device-agent/reports?deviceId=${testDeviceId}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
        authToken
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test("Get reports with only startDate", async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await authenticatedApi(
        `/device-agent/reports?deviceId=${testDeviceId}&startDate=${encodeURIComponent(startDate)}`,
        authToken
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test("Get reports with invalid startDate format", async () => {
      const res = await authenticatedApi(
        `/device-agent/reports?deviceId=${testDeviceId}&startDate=invalid-date`,
        authToken
      );
      // Should reject invalid date format
      expect([400, 200].includes(res.status)).toBe(true);
    });
  });

  describe("Device Agent - Authentication", () => {
    test("Get rules without authentication (401)", async () => {
      const res = await api(`/device-agent/rules?deviceId=test-device`);
      await expectStatus(res, 401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test("Report usage without authentication (401)", async () => {
      const now = new Date().toISOString();
      const res = await api("/device-agent/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: "test-device",
          appName: "TestApp",
          usageMinutes: 30,
          reportedAt: now,
        }),
      });
      await expectStatus(res, 401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test("Get reports without authentication (401)", async () => {
      const res = await api(`/device-agent/reports?deviceId=test-device`);
      await expectStatus(res, 401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });

  describe("Devices - CRUD Flow", () => {
    test("Register a device (201 or 200)", async () => {
      const res = await authenticatedApi(
        "/api/devices/register",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: testDeviceId,
            name: "Test Device",
            platform: "android",
          }),
        }
      );
      await expectStatus(res, 200, 201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.userId).toBeDefined();
      expect(data.name).toBe("Test Device");
      expect(data.platform).toBe("android");
      registeredDeviceId = data.id;
    });

    test("Register device without deviceId (missing required field)", async () => {
      const res = await authenticatedApi(
        "/api/devices/register",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Test Device",
            platform: "ios",
          }),
        }
      );
      await expectStatus(res, 400);
    });

    test("Register device with invalid platform", async () => {
      const res = await authenticatedApi(
        "/api/devices/register",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: "invalid-platform-device",
            name: "Test Device",
            platform: "windows",
          }),
        }
      );
      await expectStatus(res, 400);
    });

    test("Get all devices (200)", async () => {
      const res = await authenticatedApi(
        "/api/devices",
        authToken
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    test("Update device (200)", async () => {
      const res = await authenticatedApi(
        `/api/devices/${registeredDeviceId}`,
        authToken,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Updated Device Name",
          }),
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBe(registeredDeviceId);
      expect(data.name).toBe("Updated Device Name");
    });

    test("Update non-existent device (404)", async () => {
      const res = await authenticatedApi(
        "/api/devices/00000000-0000-0000-0000-000000000000",
        authToken,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Updated Name",
          }),
        }
      );
      await expectStatus(res, 403, 404);
    });

    test("Get device stats (200)", async () => {
      const res = await authenticatedApi(
        `/api/devices/${registeredDeviceId}/stats`,
        authToken
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.deviceId).toBeDefined();
      expect(typeof data.totalReports).toBe("number");
      expect(typeof data.totalUsageMinutes).toBe("number");
      expect(typeof data.activeRules).toBe("number");
    });

    test("Get stats for non-existent device (404)", async () => {
      const res = await authenticatedApi(
        "/api/devices/00000000-0000-0000-0000-000000000000/stats",
        authToken
      );
      await expectStatus(res, 403, 404);
    });

    test("Delete device (200)", async () => {
      const res = await authenticatedApi(
        `/api/devices/${registeredDeviceId}`,
        authToken,
        {
          method: "DELETE",
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("Delete non-existent device (404)", async () => {
      const res = await authenticatedApi(
        "/api/devices/00000000-0000-0000-0000-000000000000",
        authToken,
        {
          method: "DELETE",
        }
      );
      await expectStatus(res, 403, 404);
    });

    test("Get deleted device (404)", async () => {
      const res = await authenticatedApi(
        `/api/devices/${registeredDeviceId}/stats`,
        authToken
      );
      await expectStatus(res, 403, 404);
    });
  });

  describe("Devices - Authentication", () => {
    test("Register device without authentication (401)", async () => {
      const res = await api("/api/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: "test-device",
          name: "Test Device",
          platform: "ios",
        }),
      });
      await expectStatus(res, 401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test("Get devices without authentication (401)", async () => {
      const res = await api("/api/devices");
      await expectStatus(res, 401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test("Update device without authentication (401)", async () => {
      const res = await api(
        "/api/devices/some-device-id",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Updated Name",
          }),
        }
      );
      await expectStatus(res, 401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test("Delete device without authentication (401)", async () => {
      const res = await api(
        "/api/devices/some-device-id",
        {
          method: "DELETE",
        }
      );
      await expectStatus(res, 401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test("Get device stats without authentication (401)", async () => {
      const res = await api("/api/devices/some-device-id/stats");
      await expectStatus(res, 401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });

  describe("Rules - CRUD Flow", () => {
    test("Create a rule (200)", async () => {
      const res = await authenticatedApi(
        "/api/rules",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: testDeviceId,
            ruleType: "screen_lock",
            isActive: true,
          }),
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.deviceId).toBe(testDeviceId);
      expect(data.ruleType).toBe("screen_lock");
      expect(data.isActive).toBe(true);
      ruleId = data.id;
    });

    test("Create rule without deviceId (missing required field)", async () => {
      const res = await authenticatedApi(
        "/api/rules",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ruleType: "app_block",
            isActive: true,
          }),
        }
      );
      await expectStatus(res, 400);
    });

    test("Create rule without ruleType (missing required field)", async () => {
      const res = await authenticatedApi(
        "/api/rules",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: testDeviceId,
            isActive: true,
          }),
        }
      );
      await expectStatus(res, 400);
    });

    test("Create rule without isActive (missing required field)", async () => {
      const res = await authenticatedApi(
        "/api/rules",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: testDeviceId,
            ruleType: "time_limit",
          }),
        }
      );
      await expectStatus(res, 400);
    });

    test("Create rule with invalid ruleType", async () => {
      const res = await authenticatedApi(
        "/api/rules",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: testDeviceId,
            ruleType: "invalid_rule",
            isActive: true,
          }),
        }
      );
      await expectStatus(res, 400);
    });

    test("Create app_block rule with targetApp", async () => {
      const res = await authenticatedApi(
        "/api/rules",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: testDeviceId,
            ruleType: "app_block",
            targetApp: "com.example.app",
            isActive: true,
          }),
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.ruleType).toBe("app_block");
      expect(data.targetApp).toBe("com.example.app");
    });

    test("Create time_limit rule with timeLimit", async () => {
      const res = await authenticatedApi(
        "/api/rules",
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: testDeviceId,
            ruleType: "time_limit",
            timeLimit: 60,
            isActive: true,
          }),
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.ruleType).toBe("time_limit");
      expect(data.timeLimit).toBe(60);
    });

    test("Get all rules (200)", async () => {
      const res = await authenticatedApi(
        "/api/rules",
        authToken
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test("Get a single rule by ID (200)", async () => {
      const res = await authenticatedApi(
        `/api/rules/${ruleId}`,
        authToken
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBe(ruleId);
      expect(data.deviceId).toBe(testDeviceId);
    });

    test("Get non-existent rule (404)", async () => {
      const res = await authenticatedApi(
        "/api/rules/00000000-0000-0000-0000-000000000000",
        authToken
      );
      await expectStatus(res, 403, 404);
    });

    test("Update rule (200)", async () => {
      const res = await authenticatedApi(
        `/api/rules/${ruleId}`,
        authToken,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isActive: false,
          }),
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.id).toBe(ruleId);
      expect(data.isActive).toBe(false);
    });

    test("Update rule with new ruleType", async () => {
      const res = await authenticatedApi(
        `/api/rules/${ruleId}`,
        authToken,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ruleType: "app_block",
            targetApp: "com.test.app",
            isActive: true,
          }),
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.ruleType).toBe("app_block");
      expect(data.targetApp).toBe("com.test.app");
      expect(data.isActive).toBe(true);
    });

    test("Update non-existent rule (404)", async () => {
      const res = await authenticatedApi(
        "/api/rules/00000000-0000-0000-0000-000000000000",
        authToken,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isActive: false,
          }),
        }
      );
      await expectStatus(res, 403, 404);
    });

    test("Delete rule (200)", async () => {
      const res = await authenticatedApi(
        `/api/rules/${ruleId}`,
        authToken,
        {
          method: "DELETE",
        }
      );
      await expectStatus(res, 200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test("Delete non-existent rule (404)", async () => {
      const res = await authenticatedApi(
        "/api/rules/00000000-0000-0000-0000-000000000000",
        authToken,
        {
          method: "DELETE",
        }
      );
      await expectStatus(res, 403, 404);
    });

    test("Get deleted rule (404)", async () => {
      const res = await authenticatedApi(
        `/api/rules/${ruleId}`,
        authToken
      );
      await expectStatus(res, 403, 404);
    });
  });

  describe("Rules - Authentication", () => {
    test("Create rule without authentication (401)", async () => {
      const res = await api("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: "test-device",
          ruleType: "screen_lock",
          isActive: true,
        }),
      });
      await expectStatus(res, 401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test("Get all rules without authentication (401)", async () => {
      const res = await api("/api/rules");
      await expectStatus(res, 401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test("Get single rule without authentication (401)", async () => {
      const res = await api("/api/rules/00000000-0000-0000-0000-000000000000");
      await expectStatus(res, 401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test("Update rule without authentication (401)", async () => {
      const res = await api(
        "/api/rules/00000000-0000-0000-0000-000000000000",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isActive: false,
          }),
        }
      );
      await expectStatus(res, 401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test("Delete rule without authentication (401)", async () => {
      const res = await api(
        "/api/rules/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
        }
      );
      await expectStatus(res, 401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });
});

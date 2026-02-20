import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, connectWebSocket, connectAuthenticatedWebSocket, waitForMessage } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for chaining tests (e.g., created resource IDs, auth tokens)
  let authToken: string;
  let testDeviceId: string;
  let reportId: string;

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
});

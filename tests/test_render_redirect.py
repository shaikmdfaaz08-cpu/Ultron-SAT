"""Smoke-test the minimal Render ASGI app with only Python's stdlib."""
import asyncio
import json
import unittest

from backend.app import app, GITHUB_PAGES


async def call(path="/", method="GET"):
    sent = []

    async def send(message):
        sent.append(message)

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    await app({"type": "http", "path": path, "method": method}, receive, send)
    response = sent[0]
    headers = dict(response["headers"])
    return response["status"], headers, sent[1]["body"]


class RedirectTests(unittest.TestCase):
    def test_root_opens_github_pages(self):
        status, headers, body = asyncio.run(call("/"))
        self.assertEqual(status, 302)
        self.assertEqual(headers[b"location"], GITHUB_PAGES.encode("ascii"))
        self.assertEqual(body, b"")

    def test_legacy_routes_do_not_execute_models(self):
        for route in ("/analyze", "/rgb", "/ultron_esp32_telemetry.js", "/other"):
            status, headers, body = asyncio.run(call(route))
            self.assertEqual(status, 302)
            self.assertEqual(headers[b"location"], GITHUB_PAGES.encode("ascii"))
            self.assertEqual(body, b"")

    def test_health_is_lightweight(self):
        status, headers, body = asyncio.run(call("/health"))
        self.assertEqual(status, 200)
        self.assertEqual(headers[b"content-type"], b"application/json; charset=utf-8")
        self.assertEqual(json.loads(body)["mode"], "redirect-only")

    def test_head_has_no_body(self):
        status, headers, body = asyncio.run(call("/", "HEAD"))
        self.assertEqual(status, 302)
        self.assertEqual(body, b"")


if __name__ == "__main__":
    unittest.main()

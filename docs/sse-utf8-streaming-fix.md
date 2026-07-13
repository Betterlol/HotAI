# SSE UTF-8 Streaming Fix

## Symptom

OpenAI-compatible streaming requests could fail with `stream_non_json_chunk`.
The client received a truncated JSON prefix such as:

```text
{"choices":[{"delta":{"reasoning_content":"...
```

The gateway log then reported `client_gone` because the client stopped reading
after it could not decode that SSE data block.

## Root Cause

The relay emitted `Content-Type: text/event-stream` without a charset.
Clients that use `requests.iter_lines(decode_unicode=True)` may default to a
single-byte encoding. UTF-8 bytes in Chinese output can then be interpreted as
line separators, splitting one JSON SSE event into multiple client lines.

`helper.SetEventStreamHeaders` set the intended header, but the first
`common.CustomEvent` render replaced it with the charset-less value. Both paths
must declare UTF-8.

## Fix

Use this header for every SSE response:

```http
Content-Type: text/event-stream; charset=utf-8
```

The header is set in both locations that can write SSE output:

- `relay/helper/common.go`: `SetEventStreamHeaders`
- `common/custom-event.go`: `CustomEvent.WriteContentType`

The shared stream scanner also preserves malformed upstream continuation data
without forwarding a physically split JSON data line.

## Verification

Build and restart the local backend:

```bash
docker compose -f docker-compose.dev.yml up -d --build new-api
```

Confirm a streaming response includes `charset=utf-8` and that every `data:`
payload is valid JSON until `[DONE]`.

Run the B streaming regression suite:

```bash
cd /home/yihan/internship_project/test_files
python3 test_b_samples.py
```

The generated `openai_compatible_b_test_results_*.json` must report:

```json
{
  "success_count": 5,
  "failed_count": 0,
  "success_rate_percent": 100
}
```

Run relay unit tests before merging:

```bash
go test ./relay/...
```

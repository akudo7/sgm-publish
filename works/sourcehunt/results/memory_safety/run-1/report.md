# Security Audit Report

## Executive Summary
- **Scan Target:** `/home/akudo/Desktop/Work/ffmpeg-vuln`
- **Total Findings:** 7
- **Severity Breakdown:**
  - 🔴 Critical: 1
  - 🟠 High: 3
  - 🟡 Medium: 2
  - 🟢 Low: 1

The audit identified multiple memory safety vulnerabilities across FFmpeg's codec and demuxer modules. The most critical issue involves a 32-bit signed integer overflow in the VP9 decoder leading to out-of-bounds writes. Several high-severity findings relate to integer overflows in HEVC decoding and dangling pointer dereferences in VP9 frame management. Medium and low-severity issues include NULL pointer dereferences, unsigned underflows, and missing bounds checks in MOV parsing.

## Findings

### [MEDIUM] libavcodec/h264_slice.c:142
- **Description:** In `release_unused_pictures`, the code dereferences `h->DPB[i].f` without checking for `NULL`. Unused DPB slots have `f` set to `NULL`, causing a segmentation fault when accessing `buf[0]`.
- **Evidence Level:** 2
- **PoC:** 
  ```c
  void release_unused_pictures(H264Context *h) {
      for (int i = 0; i < 16; i++) {
          /* VULNERABILITY: Missing NULL check on h->DPB[i].f */
          h->DPB[i].f->buf[0] = NULL; // Crashes if h->DPB[i].f == NULL
      }
  }
  ```
- **Remediation Recommendation:** Add an explicit `NULL` check before dereferencing:
  ```c
  if (h->DPB[i].f) {
      h->DPB[i].f->buf[0] = NULL;
  }
  ```

### [MEDIUM] libavformat/mov.c:208
- **Description:** Unsigned integer underflow in length calculation bypasses bounds checks. `avio_get_str` may return a value larger than the current buffer limit, causing wrap-around when subtracted from `len`.
- **Evidence Level:** 2
- **PoC:** 
  ```c
  uint64_t returned_len = mock_avio_get_str(malformed_data, sizeof(place));
  len -= returned_len; // Underflow wraps to large positive value
  if (len < 1 || len < 12) { /* Bypassed */ }
  ```
- **Remediation Recommendation:** Validate that the returned length does not exceed the available buffer before subtraction. Use safe arithmetic or explicit bounds checking:
  ```c
  if (returned_len > len) return AVERROR_INVALIDDATA;
  len -= returned_len;
  ```

### [LOW] libavformat/mov.c:118
- **Description:** Missing length validation before reading metadata bytes. The function reads 4 bytes without verifying `len >= 4`, risking out-of-bounds reads from the stream.
- **Evidence Level:** 1
- **PoC:** Not available (`insufficient_evidence`)
- **Remediation Recommendation:** Enforce a minimum length check before any stream reads:
  ```c
  if (len < 4) return AVERROR_INVALIDDATA;
  // Proceed with avio_r8() or similar
  ```

### [CRITICAL] libavcodec/vp9.c:85
- **Description:** The calculation `sz = 64 * s->sb_cols * s->sb_rows;` uses 32-bit signed integer arithmetic. Large dimensions cause overflow, wrapping `sz` to a negative or small value. Pointer arithmetic then targets invalid memory, leading to out-of-bounds writes.
- **Evidence Level:** 2
- **PoC:** 
  ```c
  int32_t sz = 64 * s->sb_cols * s->sb_rows; // Overflows with large dims
  uint8_t *target = s->extradata + sz;      // Points before/incorrectly in buffer
  ```
- **Remediation Recommendation:** Use 64-bit arithmetic for size calculations and clamp input dimensions during bitstream parsing:
  ```c
  int64_t sz = 64LL * s->sb_cols * s->sb_rows;
  if (sz <= 0 || sz > MAX_ALLOWED_SIZE) return AVERROR_INVALIDDATA;
  ```

### [HIGH] libavcodec/hevcdec.c:118
- **Description:** Integer overflow in `min_pu_size * sizeof(MvField)` passed to `av_buffer_pool_init`. Crafted SPS parameters cause the multiplication to wrap to a small/negative value, triggering an undersized heap allocation. Subsequent decoding writes exceed bounds.
- **Evidence Level:** 2
- **PoC:** 
  ```c
  int32_t min_pu_size = min_pu_width * min_pu_height; // Overflows to 0
  int32_t pool_size = min_pu_size * sizeof(MvField);  // Allocates undersized buffer
  ```
- **Remediation Recommendation:** Promote calculations to 64-bit and validate against allocation limits:
  ```c
  int64_t pool_size = (int64_t)min_pu_size * sizeof(MvField);
  if (pool_size <= 0 || pool_size > MAX_POOL_SIZE) return AVERROR_INVALIDDATA;
  ```

### [HIGH] libavcodec/hevcdec.c:47
- **Description:** Integer overflow in `min_pu_size` calculation combined with missing overflow checks in `av_buffer_pool_init` leads to undersized heap allocations. Malicious SPS parameters cause wrap-around to a small positive value.
- **Evidence Level:** 1
- **PoC:** Not available (`insufficient_evidence`)
- **Remediation Recommendation:** Validate `sps->min_pu_width` and `sps->min_pu_height` before multiplication. Use 64-bit arithmetic and explicit overflow detection:
  ```c
  if (sps->min_pu_width <= 0 || sps->min_pu_height <= 0) return AVERROR_INVALIDDATA;
  int64_t min_pu_size = (int64_t)sps->min_pu_width * sps->min_pu_height;
  ```

### [HIGH] libavcodec/vp9.c:104
- **Description:** Missing null-assignment of `f->mv` in `vp9_frame_unref` leaves a dangling pointer after `f->extradata` is freed. Subsequent frame reuse or concurrent access dereferences freed memory.
- **Evidence Level:** 2
- **PoC:** 
  ```c
  void vp9_frame_unref(struct vp9_frame *f) {
      free(f->extradata);
      // BUG: f->mv = NULL; // Missing
      f->hwaccel_picture_private = NULL;
  }
  ```
- **Remediation Recommendation:** Explicitly nullify all pointers that reference freed memory immediately after deallocation:
  ```c
  free(f->extradata);
  f->mv = NULL;
  f->hwaccel_picture_private = NULL;
  ```

## Methodology
- **Reflexion Loop Iterations:** 10
- **Specialist Modes Used:** `memory_safety`
- **Analysis Approach:** Automated static analysis combined with iterative reflexion loops focused on memory safety patterns (NULL dereferences, integer overflows, out-of-bounds access, use-after-free). Each finding was validated against FFmpeg's codebase structure, with PoCs generated where evidence level permitted.

## Appendix
### ReflexionHistory Summary
- **Iterations Applied:** 10
- **Focus Domain:** Memory safety vulnerabilities in C-based multimedia libraries
- **Verification Window:** 2026-05-07T22:52:57Z to 2026-05-07T23:05:51Z
- **Evidence Distribution:** 
  - Level 2 (High Confidence): 5 findings
  - Level 1 (Moderate Confidence): 2 findings
- **Exploit Status:** 5 findings have generated PoCs (`generated`), 2 remain at `insufficient_evidence` due to missing contextual bounds or dynamic execution traces.
- **Key Patterns Identified:** 
  - Unchecked 32-bit arithmetic in codec dimension/size calculations
  - Missing pointer nullification during resource teardown
  - Inadequate bounds validation in container format parsers
- **Recommendation for Next Cycle:** Prioritize patching Critical and High severity findings. Implement compile-time integer overflow detection (`-ftrapv` or static analysis rules) and enforce strict pointer lifecycle management in frame allocation/unreference routines.
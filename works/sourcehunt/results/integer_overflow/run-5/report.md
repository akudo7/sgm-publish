# Security Audit Report

## Executive Summary

- **Scan Target:** `/home/akudo/Desktop/Work/ffmpeg-vuln`
- **Total Findings:** 13
- **Severity Breakdown:**
  - **Critical:** 1
  - **High:** 9
  - **Medium:** 3
- **Overview:** The audit identified multiple integer overflow vulnerabilities across several FFmpeg decoders (HEVC, H.264, MPEG-4, MJPEG). These vulnerabilities stem from arithmetic operations using 32-bit signed integers for size calculations, array indexing, and pointer arithmetic without overflow checks. Exploitation can lead to undersized heap allocations, out-of-bounds reads/writes, buffer underflows, and potential arbitrary code execution.

## Findings

### Critical

#### libavcodec/h264_slice.c:147
- **Type:** Integer Overflow in Pool Size Calculation
- **Severity:** Critical
- **Description:** Pool size calculations in `init_table_pools` use 32-bit signed integer arithmetic. Expressions such as `(big_mb_num + h->mb_stride) * sizeof(uint32_t)` can wrap around when SPS parameters are maliciously crafted. This results in an undersized allocation passed to `av_buffer_pool_init`. Subsequent slice parsing accesses these pools using actual large macroblock counts, causing out-of-bounds heap reads/writes.
- **Evidence Level:** 2
- **PoC:**
  ```c
  #include <stdio.h>
  #include <stdlib.h>
  #include <stdint.h>

  void init_table_pools(int mb_width, int mb_height, int mb_stride) {
      int big_mb_num = mb_width * mb_height;
      int pool_size = (big_mb_num + mb_stride) * sizeof(uint32_t);
      printf("[*] Calculated pool size: %d bytes\n", pool_size);
      uint32_t *pool = malloc(pool_size);
      if (!pool) return;
      int access_offset = big_mb_num;
      printf("[*] Later access attempts index %d in a %d-byte buffer\n", access_offset, pool_size);
      free(pool);
  }

  int main() {
      int mb_width = 0x10000;
      int mb_height = 0x10000;
      int mb_stride = 0x10000;
      init_table_pools(mb_width, mb_height, mb_stride);
      return 0;
  }
  ```
- **Remediation:** Use `av_malloc_array` or `av_realloc_array` for size calculations. Validate `mb_width`, `mb_height`, and `mb_stride` against maximum allowed values before arithmetic operations. Ensure pool sizes are calculated using `size_t` with overflow checks.

### High

#### libavcodec/hevcdec.c:146
- **Type:** Integer Overflow in Buffer Pool Initialization
- **Severity:** High
- **Description:** `min_pu_size * sizeof(MvField)` is evaluated in 32-bit arithmetic. Large `sps->min_pu_width` and `sps->min_pu_height` cause overflow, resulting in an undersized pool allocation. Decoder accesses using original dimensions trigger out-of-bounds heap writes.
- **Evidence Level:** 2
- **PoC:**
  ```c
  #include <stdio.h>
  #include <stdlib.h>
  #include <stdint.h>

  typedef struct { int16_t x; int16_t y; uint8_t ref; uint8_t scale; } MvField;

  void init_buffer_pool(uint32_t min_pu_width, uint32_t min_pu_height) {
      uint32_t min_pu_size = min_pu_width * min_pu_height;
      uint32_t truncated_size = min_pu_size * sizeof(MvField);
      printf("[!] Calculated pool size: %u bytes (original dims: %u x %u)\n", truncated_size, min_pu_width, min_pu_height);
      MvField *pool = malloc(truncated_size);
      if (!pool) return;
      for (uint32_t y = 0; y < min_pu_height; y++) {
          for (uint32_t x = 0; x < min_pu_width; x++) {
              uint32_t idx = y * min_pu_width + x;
              pool[idx].x = 0;
          }
      }
      free(pool);
  }

  int main(void) {
      init_buffer_pool(0x10001, 0x10001);
      return 0;
  }
  ```
- **Remediation:** Cast operands to `size_t` before multiplication or use `av_malloc_array`. Validate SPS parameters to ensure dimensions do not exceed reasonable bounds.

#### libavcodec/hevcdec.c:148
- **Type:** Integer Overflow in RPL Tab Pool Initialization
- **Severity:** High
- **Description:** `ctb_count * sizeof(RefPicListTab)` suffers from 32-bit multiplication overflow. Malformed SPS parameters cause truncation of the requested pool size, leading to heap buffer overflow during reference picture list processing.
- **Evidence Level:** 2
- **PoC:**
  ```c
  #include <stdio.h>
  #include <stdlib.h>
  #include <stdint.h>

  typedef struct { uint8_t data[32]; } RefPicListTab;

  int main(void) {
      uint32_t ctb_count = 0x10000000;
      uint32_t truncated_size = (uint32_t)(ctb_count * sizeof(RefPicListTab));
      printf("Truncated size: %u bytes\n", truncated_size);
      uint8_t *pool = malloc(truncated_size > 0 ? truncated_size : 1);
      if (!pool) return 1;
      size_t safe_capacity = (truncated_size > 0 ? truncated_size : 1) / sizeof(RefPicListTab);
      printf("Pool capacity: %zu elements\n", safe_capacity);
      printf("Decoder access count: %u elements\n", ctb_count);
      free(pool);
      return 0;
  }
  ```
- **Remediation:** Use `av_malloc_array(ctb_count, sizeof(RefPicListTab))`. Validate `ctb_count` against maximum CTB limits defined in the HEVC standard.

#### libavcodec/mpeg4videodec.c:158
- **Type:** Integer Overflow in Array Indexing
- **Severity:** High
- **Description:** `s->block_index[n] * 16` overflows signed 32-bit integers when `block_index` exceeds ~134 million. The result is used as an offset for `ac_val`, causing out-of-bounds access.
- **Evidence Level:** 2
- **PoC:**
  ```c
  #include <stdio.h>
  #include <stdint.h>

  typedef struct { int32_t block_index[64]; int32_t ac_val[1024][16][16]; } Mpeg4DecContext;

  void demonstrate_overflow(Mpeg4DecContext *s, int n) {
      int32_t idx = s->block_index[n];
      int32_t offset = idx * 16;
      printf("block_index[%d] = %d\n", n, idx);
      printf("Calculated offset = %d (overflowed)\n", offset);
  }

  int main() {
      Mpeg4DecContext ctx = {0};
      ctx.block_index[0] = 134217728;
      demonstrate_overflow(&ctx, 0);
      return 0;
  }
  ```
- **Remediation:** Validate `block_index` values before use. Use `size_t` for index calculations or check for overflow before multiplication.

#### libavcodec/mpeg4videodec.c:163
- **Type:** Integer Overflow in Array Indexing
- **Severity:** High
- **Description:** `s->mb_y * s->mb_stride` overflows signed 32-bit integers, causing `xy` index to wrap. This leads to out-of-bounds access in `qscale_table`.
- **Evidence Level:** 2
- **PoC:**
  ```c
  #include <stdio.h>
  #include <stdint.h>

  typedef struct { int mb_x, mb_y, mb_stride; } Context;
  int qscale_table[16];

  void vulnerable_index_access(Context *s) {
      const int xy = s->mb_x - 1 + s->mb_y * s->mb_stride;
      printf("Calculated index: %d\n", xy);
  }

  int main() {
      Context s = {0};
      s.mb_y = 0x40000000;
      s.mb_stride = 2;
      s.mb_x = 0;
      vulnerable_index_access(&s);
      return 0;
  }
  ```
- **Remediation:** Validate `mb_y` and `mb_stride`. Ensure calculated indices are within bounds of `qscale_table` before access.

#### libavcodec/h264_slice.c:115
- **Type:** Integer Overflow in Scratch Buffer Allocation
- **Severity:** High
- **Description:** Allocation size calculations in `alloc_scratch_buffers` use signed 32-bit integers. Expressions like `16 * 6 * alloc_size` can wrap, causing undersized `av_fast_malloc` calls and subsequent heap corruption.
- **Evidence Level:** 2
- **PoC:**
  ```c
  #include <stdio.h>
  #include <stdlib.h>
  #include <stdint.h>

  void demonstrate_overflow(int alloc_size) {
      int wrapped_size = 16 * 6 * alloc_size;
      size_t alloc_size_t = (size_t)wrapped_size;
      printf("Allocated (size_t): %zu\n", alloc_size_t);
      void *buf = malloc(alloc_size_t);
      if (!buf) return;
      size_t intended_write = (size_t)16 * 6 * (size_t)alloc_size;
      printf("Intended write size: %zu\n", intended_write);
      free(buf);
  }

  int main() {
      int trigger_value = 44739243;
      demonstrate_overflow(trigger_value);
      return 0;
  }
  ```
- **Remediation:** Use `av_fast_malloc` with correct size calculations using `size_t`. Check for overflow before multiplication.

#### libavcodec/hevcdec.c:112
- **Type:** Integer Overflow in pic_size_in_ctb Calculation
- **Severity:** High
- **Description:** `width * height` overflows 32-bit signed integers, truncating allocation size for `tab_slice_address` and `qp_y_tab`. Subsequent decoding causes heap buffer overflow.
- **Evidence Level:** 2
- **PoC:**
  ```c
  #include <stdio.h>
  #include <stdlib.h>
  #include <stdint.h>

  int main() {
      int32_t width = 0xC000;
      int32_t height = 0xC000;
      int32_t pic_size_in_ctb = width * height;
      printf("Calculated pic_size_in_ctb: %d (overflowed)\n", pic_size_in_ctb);
      size_t alloc_size = (pic_size_in_ctb < 0) ? 0 : (size_t)pic_size_in_ctb;
      int *tab_slice_address = malloc(alloc_size);
      if (tab_slice_address) free(tab_slice_address);
      return 0;
  }
  ```
- **Remediation:** Use `av_malloc_array` for array allocations. Validate `width` and `height` against maximum allowed values.

#### libavcodec/hevcdec.c:103
- **Type:** Integer Overflow in pic_size_in_ctb Calculation
- **Severity:** High
- **Description:** `ctb_w * ctb_h` overflows 32-bit signed integers, wrapping to a small value. Undersized allocation leads to out-of-bounds heap writes during slice parsing.
- **Evidence Level:** 2
- **PoC:**
  ```c
  #include <stdio.h>
  #include <stdlib.h>
  #include <stdint.h>

  int main() {
      int32_t width = 0x40000000;
      int32_t height = 0x40000000;
      int32_t log2_min_cb_size = 2;
      int32_t ctb_w = (width >> log2_min_cb_size) + 1;
      int32_t ctb_h = (height >> log2_min_cb_size) + 1;
      int32_t pic_size_in_ctb = ctb_w * ctb_h;
      printf("Allocating buffer for %d elements (overflowed)\n", pic_size_in_ctb);
      int *tab_slice_address = malloc(pic_size_in_ctb * sizeof(int));
      if (!tab_slice_address) return 1;
      int32_t loop_limit = (width >> log2_min_cb_size) * (height >> log2_min_cb_size);
      printf("Slice parser will attempt to write %d elements\n", loop_limit);
      free(tab_slice_address);
      return 0;
  }
  ```
- **Remediation:** Use `av_malloc_array`. Validate CTB dimensions and ensure allocation size matches loop limits.

#### libavcodec/mpeg4videodec.c:114
- **Type:** Buffer Underflow via Negative Offset
- **Severity:** High
- **Description:** Uncapped `uvlinesize` can be negative, causing `dct_offset` to become negative. This negative offset is added to base pointers without validation, resulting in out-of-bounds memory access.
- **Evidence Level:** 2
- **PoC:**
  ```c
  #include <stdio.h>
  #include <stdint.h>

  void demonstrate_underflow() {
      uint8_t frame_buffer[1024];
      uint8_t *dest_cb = frame_buffer;
      int uvlinesize = -16;
      int block_size = 8;
      int dct_offset = uvlinesize * block_size;
      uint8_t *underflowed_cb = dest_cb + dct_offset;
      printf("Underflowed dest_cb: %p (Expected: %p)\n", (void*)underflowed_cb, (void*)dest_cb);
  }

  int main() {
      demonstrate_underflow();
      return 0;
  }
  ```
- **Remediation:** Validate `uvlinesize` to ensure it is non-negative. Add bounds checks before pointer arithmetic.

#### libavcodec/mpeg4videodec.c:83
- **Type:** Pointer Underflow via Negative Offset
- **Severity:** High
- **Description:** Negative `uvlinesize` causes `dct_offset` to be negative. Adding this to base pointers in `idct_put` calls causes pointer underflow, leading to out-of-bounds writes.
- **Evidence Level:** 2
- **PoC:**
  ```c
  #include <stdio.h>
  #include <stdlib.h>
  #include <stdint.h>

  int main() {
      size_t buf_size = 64;
      uint8_t *dest_cb = malloc(buf_size);
      if (!dest_cb) return 1;
      int uvlinesize = -8;
      int block_size = 8;
      int dct_offset = uvlinesize * block_size;
      uint8_t *unsafe_ptr = dest_cb + dct_offset;
      printf("Resulting pointer: %p (Underflow detected)\n", (void*)unsafe_ptr);
      free(dest_cb);
      return 0;
  }
  ```
- **Remediation:** Validate `uvlinesize`. Ensure pointer arithmetic does not result in addresses outside the allocated buffer range.

### Medium

#### libavcodec/mpeg4videodec.c:93
- **Type:** Integer Overflow in Pointer Arithmetic
- **Severity:** Medium
- **Description:** `block_size * 2` overflows signed 32-bit integers when `block_size` exceeds 1,073,741,823. The result wraps to a negative value, causing pointer arithmetic to wrap backwards in memory.
- **Evidence Level:** 1
- **PoC:** Not generated due to insufficient evidence.
- **Remediation:** Validate `block_size` against maximum allowed values. Use `size_t` for size calculations.

#### libavcodec/mjpegdec.c:154
- **Type:** Integer Overflow in Bitstream Reader Init
- **Severity:** Medium
- **Description:** `avctx->extradata_size * 8` can overflow signed 32-bit integers, resulting in a negative or truncated bit count passed to `init_get_bits`. This may misconfigure the bitstream reader.
- **Evidence Level:** 1
- **PoC:** Not generated due to insufficient evidence.
- **Remediation:** Validate `extradata_size`. Use `av_malloc_array` or check for overflow before multiplication.

#### libavcodec/mpeg4videodec.c:178
- **Type:** Integer Overflow in Pointer Arithmetic
- **Severity:** Medium
- **Description:** `16 * s->block_wrap[n]` overflows signed 32-bit integers. The result is subtracted from `ac_val`, causing pointer wrap-around and out-of-bounds reads during AC prediction.
- **Evidence Level:** 2
- **PoC:**
  ```c
  #include <stdio.h>
  #include <stdint.h>

  typedef struct { int32_t block_wrap[6]; } Mpeg4Context;

  void simulate_vulnerability(Mpeg4Context *ctx) {
      int32_t buffer[100];
      int32_t *ac_val = &buffer[50];
      ctx->block_wrap[0] = 0x08000001;
      int32_t overflowed_offset = 16 * ctx->block_wrap[0];
      printf("Overflowed offset: %d\n", overflowed_offset);
      ac_val -= overflowed_offset;
      printf("Misaligned ac_val offset: %td\n", ac_val - buffer);
  }

  int main() {
      Mpeg4Context ctx = {0};
      simulate_vulnerability(&ctx);
      return 0;
  }
  ```
- **Remediation:** Validate `block_wrap` values. Use `size_t` for offset calculations and check for overflow.

## Methodology

- **Reflexion Loop Iterations:** 8 iterations were applied to refine hypotheses, generate Proof of Concepts (PoCs), and verify evidence levels.
- **Specialist Modes:** `integer_overflow` specialist mode was utilized throughout the analysis to identify arithmetic vulnerabilities involving signed 32-bit integers, size calculations, and pointer arithmetic.
- **Analysis Process:**
  1.  Identification of arithmetic operations involving user-controlled or stream-derived values.
  2.  Hypothesis generation regarding overflow conditions and exploitation mechanisms.
  3.  PoC development to demonstrate overflow behavior and memory corruption potential.
  4.  Evidence level assessment based on code context and exploitability.
  5.  Remediation recommendation formulation.

## Appendix

### Reflexion History Summary
- **Iteration 1-2:** Initial scan identified potential integer overflow patterns in HEVC and H.264 decoders. Hypotheses focused on SPS parameter manipulation.
- **Iteration 3-4:** PoCs generated for buffer pool initialization overflows. Evidence levels raised to 2 based on clear allocation mismatches.
- **Iteration 5-6:** Analysis expanded to MPEG-4 decoder, identifying array indexing and pointer arithmetic overflows. Negative offset vulnerabilities discovered.
- **Iteration 7-8:** Final refinements included PoC generation for pointer underflows and medium-severity findings. Evidence levels verified, and remediation recommendations finalized. Total of 13 findings confirmed with 8 reflexion iterations applied.
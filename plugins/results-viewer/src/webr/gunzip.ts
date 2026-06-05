/** Decompress a gzip buffer using the platform DecompressionStream. */
export async function gunzipBuffer(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}

/**
 * Expand any `*.db.gz` entries in a files map into their decompressed `*.db`
 * form, dropping the original gz entry. Non-gz entries pass through untouched.
 */
export async function expandGzEntries(
  files: Map<string, ArrayBuffer>,
): Promise<Map<string, ArrayBuffer>> {
  const out = new Map<string, ArrayBuffer>()
  for (const [name, buf] of files) {
    if (name.endsWith('.db.gz')) {
      out.set(name.slice(0, -3), await gunzipBuffer(buf))
    } else {
      out.set(name, buf)
    }
  }
  return out
}

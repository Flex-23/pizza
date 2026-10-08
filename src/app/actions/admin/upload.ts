"use server";

import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { assertStaff } from "@/lib/auth/guards";
import { getStorage } from "@/lib/storage";

/**
 * Image upload for menu items and categories.
 *
 * Only an authenticated admin may upload, and the storage layer additionally
 * checks the declared MIME type, the file size, and the file's magic number
 * before anything is written to disk.
 */
export async function uploadImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const auth = await assertStaff();
  if (!auth.ok) return fail("UNAUTHORIZED");

  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return fail("UPLOAD_FAILED");
  }

  const result = await getStorage().upload(file);

  if (!result.ok) {
    switch (result.error) {
      case "TOO_LARGE":
        return fail("UPLOAD_TOO_LARGE");
      case "WRONG_TYPE":
        return fail("UPLOAD_WRONG_TYPE");
      default:
        return fail("UPLOAD_FAILED");
    }
  }

  return ok({ url: result.url });
}

export async function deleteImageAction(url: string): Promise<ActionResult> {
  const auth = await assertStaff();
  if (!auth.ok) return fail("UNAUTHORIZED");

  await getStorage().remove(url);
  return ok();
}

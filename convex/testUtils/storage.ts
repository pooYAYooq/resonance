import type { GenericDatabaseWriter, SystemDataModel } from "convex/server";
import type { ActionCtx, MutationCtx } from "../_generated/server";

/** Preserve real Blob/storage behavior while filling convex-test's missing MIME metadata. */
export async function storeTestImage(
  ctx: Pick<MutationCtx, "db"> & Pick<ActionCtx, "storage">,
  blob = new Blob(["cover"], { type: "image/png" }),
) {
  const storageId = await ctx.storage.store(blob);
  // convex-test 0.0.51 storeBlob writes size/hash but omits contentType.
  // A real upload supplies this system field; never loosen production checks.
  const fixtureDb = ctx.db as unknown as GenericDatabaseWriter<SystemDataModel>;
  await fixtureDb.patch(storageId, { contentType: blob.type });
  return storageId;
}

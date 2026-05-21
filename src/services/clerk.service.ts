import { createClerkClient, verifyToken } from "@clerk/backend";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

export async function verifyClerkToken(token: string) {
  try {
    // Verify the short-lived Clerk session token (JWT) using standalone verifyToken
    const verifiedToken = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    });

    // Fetch the full user details using Clerk's User ID (sub)
    const clerkUser = await clerkClient.users.getUser(verifiedToken.sub);

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      throw new Error("CLERK_USER_HAS_NO_EMAIL");
    }

    return {
      clerkUserId: clerkUser.id,
      email: email.toLowerCase(),
      firstName: clerkUser.firstName || "",
      lastName: clerkUser.lastName || "",
      avatarUrl: clerkUser.imageUrl || "",
    };
  } catch (err: any) {
    console.error("Clerk token verification failed:", err);
    throw new Error("INVALID_CLERK_TOKEN");
  }
}

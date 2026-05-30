import "server-only";

import webpush from "web-push";
import { basePrisma } from "@/lib/prisma-core";
import { getConfiguredAppUrl } from "@/lib/appUrl";

type PushPayload = {
  notificationId: string;
  title: string;
  body: string;
  url?: string | null;
  type?: string;
};

let webPushConfigured = false;

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();

  if (!publicKey || !privateKey) {
    return null;
  }

  return {
    publicKey,
    privateKey,
    contact:
      process.env.WEB_PUSH_CONTACT?.trim() ||
      `mailto:${new URL(getConfiguredAppUrl()).hostname}@notifications.local`,
  };
}

function configureWebPush() {
  if (webPushConfigured) {
    return true;
  }

  const vapid = getVapidConfig();

  if (!vapid) {
    return false;
  }

  webpush.setVapidDetails(vapid.contact, vapid.publicKey, vapid.privateKey);
  webPushConfigured = true;
  return true;
}

function shouldDisableSubscription(error: unknown) {
  const statusCode =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : 0;

  return statusCode === 404 || statusCode === 410;
}

export async function sendPushNotificationToUser({
  shopId,
  userId,
  notificationId,
  title,
  body,
  url,
  type,
}: {
  shopId: string;
  userId: string;
} & PushPayload) {
  if (!configureWebPush()) {
    return {
      sent: 0,
      skipped: true,
    };
  }

  const subscriptions = await basePrisma.pushSubscription.findMany({
    where: {
      shopId,
      userId,
      isActive: true,
    },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  if (subscriptions.length === 0) {
    return {
      sent: 0,
      skipped: false,
    };
  }

  const payload = JSON.stringify({
    notificationId,
    title,
    body,
    url: url || "/",
    type,
    icon: "/pwa/jakbarber/icon-192.png",
    badge: "/pwa/jakbarber/favicon-48.png",
    tag: notificationId,
  });

  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload
        );

        sent += 1;

        await basePrisma.pushSubscription.update({
          where: {
            id: subscription.id,
          },
          data: {
            failureCount: 0,
            lastSuccessAt: new Date(),
          },
        });
      } catch (error) {
        const disable = shouldDisableSubscription(error);

        await basePrisma.pushSubscription.update({
          where: {
            id: subscription.id,
          },
          data: {
            isActive: disable ? false : undefined,
            failureCount: {
              increment: 1,
            },
            lastFailureAt: new Date(),
          },
        });

        console.warn(
          `[push] Falha ao enviar notificacao ${notificationId}: ${
            error instanceof Error ? error.message : "erro desconhecido"
          }`
        );
      }
    })
  );

  return {
    sent,
    skipped: false,
  };
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  AppointmentMutationError,
  createCustomerAppointment,
  rescheduleCustomerAppointment,
} from "../lib/appointmentMutations";

type AppointmentDb = NonNullable<Parameters<typeof createCustomerAppointment>[1]>;

const booking = {
  customerId: "customer-test",
  barberId: "barber-test",
  serviceIds: [],
  date: "2026-10-08",
  time: "10:00",
  now: new Date("2026-09-17T12:00:00Z"),
  useVipPlan: true,
};

function unconfirmedSubscriberDb(asaasSubscriptionId: string | null) {
  const db = {
    $transaction: async (run: (tx: AppointmentDb) => Promise<unknown>) => run(db),
    user: {
      findFirst: async ({ where }: { where: { role: string } }) =>
        where.role === "BARBER"
          ? { id: booking.barberId, shopId: "shop-test" }
          : { id: booking.customerId },
    },
    service: { findMany: async () => [] },
    barberServiceCommission: { findMany: async () => [] },
    barberPayout: { findFirst: async () => null },
    vipSubscription: {
      findFirst: async ({ where }: { where: Record<string, string> }) => {
        assert.deepEqual(where, {
          shopId: "shop-test",
          customerId: booking.customerId,
          status: "ACTIVE",
        });
        return {
          id: "subscription-test",
          asaasSubscriptionId,
          billingProfileConfirmedAt: null,
          tokensRemaining: 4,
          dueDay: 5,
          payments: [{ status: "PAID" }],
        };
      },
    },
    vipPayment: {
      findFirst: async () => assert.fail("Unconfirmed billing must be checked before payment access"),
    },
    appointment: {
      findUnique: async () => ({
        id: "appointment-test",
        shopId: "shop-test",
        customerId: booking.customerId,
        barberId: booking.barberId,
        date: new Date("2026-10-07T13:00:00Z"),
        status: "SCHEDULED",
        isManualFitIn: false,
        isVipPlanUse: true,
        vipSubscriptionId: "subscription-test",
        items: [],
        services: [],
      }),
      create: async () => assert.fail("Unconfirmed subscribers cannot create VIP appointments"),
      update: async () => assert.fail("Unconfirmed subscribers cannot reschedule VIP appointments"),
    },
  } as unknown as AppointmentDb;
  return db;
}

for (const providerId of [null, "sub-already-linked"]) {
  const description = providerId ? "already linked" : "legacy";

  test(`${description} paid subscriber must confirm billing before booking through the API`, async () => {
    await assert.rejects(
      createCustomerAppointment(booking, unconfirmedSubscriberDb(providerId)),
      (error: unknown) => {
        assert.ok(error instanceof AppointmentMutationError);
        assert.match(error.message, /Atualize seus dados.*antes de agendar pelo plano/);
        return true;
      }
    );
  });

  test(`${description} subscriber cannot bypass confirmation when rescheduling by clearing useVipPlan`, async () => {
    await assert.rejects(
      rescheduleCustomerAppointment(
        { ...booking, appointmentId: "appointment-test", useVipPlan: false },
        unconfirmedSubscriberDb(providerId)
      ),
      (error: unknown) => {
        assert.ok(error instanceof AppointmentMutationError);
        assert.match(error.message, /Atualize seus dados.*antes de remarcar pelo plano/);
        return true;
      }
    );
  });
}

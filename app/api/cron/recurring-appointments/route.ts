import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentShop } from "@/lib/shop";
import { extendRecurringAppointmentsForShop } from "@/lib/recurringSeries";
import { notifyCustomerAppointmentConfirmed } from "@/lib/appointmentEmails";
import { notifyBarberNewAppointment } from "@/lib/barberEmails";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ message: "Cron indisponível." }, { status: 503 });
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (Buffer.byteLength(provided) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }
  const shop = await getCurrentShop();
  if (!shop.isActive) return NextResponse.json({ message: "Barbearia indisponível." }, { status: 404 });
  const result = await extendRecurringAppointmentsForShop(shop.id);
  if (result.ids.length) {
    after(async () => {
      await Promise.allSettled(result.ids.flatMap((appointmentId) => [notifyCustomerAppointmentConfirmed(appointmentId), notifyBarberNewAppointment(appointmentId)]));
    });
  }
  return NextResponse.json(result, { status: result.failed ? 503 : 200 });
}

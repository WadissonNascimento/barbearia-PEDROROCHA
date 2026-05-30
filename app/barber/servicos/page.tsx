import { redirect } from "next/navigation";
import { requireActiveBarber } from "../guard";

export default async function BarberServicesPage() {
  await requireActiveBarber();
  redirect("/barber");
}

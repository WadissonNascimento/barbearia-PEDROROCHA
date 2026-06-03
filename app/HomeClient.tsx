"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  AtSign,
  MapPin,
  MessageCircle,
  Scissors,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CrownRating from "@/components/ui/CrownRating";

export type HomeReview = {
  id: string;
  rating: number;
  comment: string;
  customerName: string;
};

export type HomeService = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  duration: number;
};

export type HomeBarber = {
  id: string;
  name: string;
  image?: string | null;
};

type HomeClientProps = {
  reviews: HomeReview[];
  hasMoreReviews: boolean;
  homeImages?: string[];
  shopId?: string;
  brandName: string;
  addressLine: string;
  businessHours: string;
  logoPath?: string;
  whatsappNumber?: string;
  instagramUrl?: string;
  services?: HomeService[];
  barbers?: HomeBarber[];
  heroImageUrl?: string;
  heroEyebrow?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  attendanceText?: string;
  reviewsTitle?: string;
  reviewsEmptyText?: string;
};

const corteImages = [
  "/cortes/corte1.webp",
  "/cortes/corte2.webp",
  "/cortes/corte3.webp",
];

function formatReviewName(name: string) {
  const [firstName] = name.trim().split(/\s+/);

  return firstName || "Cliente";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function buildWhatsAppHref(phone: string | undefined, brandName: string) {
  const digits = (phone || "").replace(/\D/g, "");

  if (!digits) {
    return "/agendar";
  }

  const message = `Olá, ${brandName}! Quero agendar um horário.`;

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default function HomeClient(props: HomeClientProps) {
  return <DefaultHomeClient {...props} />;
}

function PedroRochaHome({
  reviews,
  hasMoreReviews,
  homeImages = [],
  brandName,
  addressLine,
  businessHours,
  logoPath,
  whatsappNumber,
  instagramUrl,
  services = [],
  barbers = [],
}: HomeClientProps) {
  const heroImage = homeImages[0] || logoPath || corteImages[0];
  const whatsappHref = buildWhatsAppHref(whatsappNumber, brandName);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#080807] text-[#f5efe3]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,_#11100f_0%,_#080807_48%,_#020202_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_22%_18%,_rgba(241,232,216,0.08),_transparent_30%),radial-gradient(circle_at_82%_8%,_rgba(255,255,255,0.045),_transparent_28%)]" />

      <section className="px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-7 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <p className="inline-flex rounded-full border border-[#f1e8d8]/15 bg-white/[0.045] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-[#ded4c4]">
              Pedro Rocha Barbearia
            </p>

            <h1 className="mt-5 max-w-2xl text-[2.35rem] font-black leading-[0.96] tracking-normal text-[#f8f3e7] sm:text-6xl lg:text-7xl">
              Corte classico, acabamento preciso.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#c9c0b2] sm:text-lg">
              Um atendimento feito com calma, tecnica e cuidado em cada detalhe
              para valorizar o seu estilo.
            </p>
          </div>

          <div className="relative min-h-[330px] overflow-hidden rounded-lg border border-[#f1e8d8]/10 bg-[#11100f] shadow-[0_28px_80px_rgba(0,0,0,0.48)] sm:min-h-[480px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-[640px]">
            <Image
              src={heroImage}
              alt={`Identidade visual da ${brandName}`}
              fill
              sizes="(max-width: 1024px) 100vw, 580px"
              quality={94}
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(0,0,0,0.05),_rgba(0,0,0,0.58))]" />
          </div>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <div className="mt-7 grid gap-3 sm:max-w-lg sm:grid-cols-2">
              <Link
                href="/agendar"
                className="inline-flex min-h-14 items-center justify-center rounded-lg bg-[#f1e8d8] px-5 text-base font-black text-[#080807] shadow-[0_18px_42px_rgba(0,0,0,0.32)] transition hover:bg-white active:scale-[0.98]"
              >
                Agendar horario
              </Link>
              <Link
                href="/servicos"
                className="inline-flex min-h-14 items-center justify-center rounded-lg border border-[#f1e8d8]/15 bg-white/[0.035] px-5 text-base font-bold text-[#f5efe3] transition hover:bg-white/[0.07] active:scale-[0.98]"
              >
                Ver servicos
              </Link>
            </div>

            <div className="mt-6 grid gap-2 text-sm text-[#c9c0b2] sm:grid-cols-3">
              <span className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <Clock3 className="mb-2 h-4 w-4 text-[#ded4c4]" aria-hidden="true" />
                {businessHours}
              </span>
              <span className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <MapPin className="mb-2 h-4 w-4 text-[#ded4c4]" aria-hidden="true" />
                {addressLine}
              </span>
              <span className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <Scissors className="mb-2 h-4 w-4 text-[#ded4c4]" aria-hidden="true" />
                Com hora marcada
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#f1e8d8]/10 bg-white/[0.025] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-3">
          {[
            ["01", "Tecnica", "Cortes executados com precisao e acabamento atento."],
            ["02", "Experiencia", "Um ambiente classico para desacelerar e cuidar de voce."],
            ["03", "Praticidade", "Agendamento simples para encaixar o cuidado na sua rotina."],
          ].map(([number, title, description]) => (
            <article key={number} className="border-l border-[#b8945f]/45 pl-4">
              <p className="text-xs font-black tracking-[0.24em] text-[#b8945f]">{number}</p>
              <h2 className="mt-3 text-xl font-black text-[#f8f3e7]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#bfb6a8]">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#b8945f]">
            Servicos
          </p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="max-w-xl text-2xl font-black text-[#f8f3e7] sm:text-4xl">
              Escolha seu proximo cuidado.
            </h2>
            <Link href="/servicos" className="text-sm font-bold text-[#ded4c4] hover:text-white">
              Ver todos os servicos
            </Link>
          </div>

          {services.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-[#f1e8d8]/15 bg-white/[0.035] p-5 text-sm text-[#c9c0b2]">
              Os servicos da Pedro Rocha Barbearia serao publicados aqui em breve.
            </div>
          ) : (
            <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {services.slice(0, 6).map((service) => (
                <article key={service.id} className="rounded-lg border border-[#f1e8d8]/15 bg-white/[0.04] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-black text-[#f8f3e7]">{service.name}</h3>
                    <span className="shrink-0 text-sm font-black text-[#ded4c4]">
                      {formatCurrency(service.price)}
                    </span>
                  </div>
                  {service.description ? (
                    <p className="mt-3 text-sm leading-6 text-[#bfb6a8]">{service.description}</p>
                  ) : null}
                  <p className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#b8945f]">
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                    {service.duration} min
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {barbers.length > 0 ? (
        <section className="px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#b8945f]">Equipe</p>
            <h2 className="mt-2 text-2xl font-black text-[#f8f3e7] sm:text-4xl">
              Profissionais que entendem seu estilo.
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {barbers.slice(0, 6).map((barber) => (
                <article key={barber.id} className="flex items-center gap-4 rounded-lg border border-[#f1e8d8]/15 bg-white/[0.04] p-4">
                  <div className="relative h-14 w-14 overflow-hidden rounded-full border border-[#f1e8d8]/15 bg-white/[0.05]">
                    {barber.image ? (
                      <Image src={barber.image} alt={barber.name} fill sizes="56px" className="object-cover" />
                    ) : (
                      <Users className="m-4 h-6 w-6 text-[#ded4c4]" aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b8945f]">Barbeiro</p>
                    <h3 className="mt-1 font-black text-[#f8f3e7]">{barber.name}</h3>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ded4c4]">
            Avaliacoes
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#f8f3e7] sm:text-4xl">
            Confianca construida no atendimento.
          </h2>

          {reviews.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-[#f1e8d8]/15 bg-white/[0.035] p-5 text-sm text-[#c9c0b2]">
              As avaliacoes da Pedro Rocha Barbearia aparecerao aqui em breve.
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {reviews.map((review) => (
                <article
                  key={review.id}
                  className="rounded-lg border border-[#f1e8d8]/15 bg-white/[0.04] p-5"
                >
                  <p className="text-sm font-black text-[#f8f3e7]">
                    {formatReviewName(review.customerName)}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <CrownRating rating={review.rating} size="sm" />
                    <span className="text-xs font-semibold text-[#c9c0b2]">
                      Nota {review.rating}/5
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#c9c0b2]">
                    {review.comment}
                  </p>
                </article>
              ))}
            </div>
          )}

          {hasMoreReviews ? (
            <div className="mt-5 flex justify-center">
              <Link
                href="/avaliacoes"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#f1e8d8]/15 px-4 py-2 text-sm font-bold text-[#f5efe3] transition hover:bg-white/[0.07]"
              >
                Ver mais avaliacoes
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="px-4 pb-14 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-lg border border-[#b8945f]/35 bg-[linear-gradient(135deg,_rgba(184,148,95,0.16),_rgba(255,255,255,0.025))] p-6 sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ded4c4]">Contato</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-black text-[#f8f3e7] sm:text-5xl">
            Reserve seu horario.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#c9c0b2] sm:text-base">
            Escolha o melhor momento para o seu atendimento e venha viver a experiencia Pedro Rocha Barbearia.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/agendar" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#f1e8d8] px-5 text-sm font-black text-[#080807] transition hover:bg-white">
              Agendar agora
            </Link>
            {whatsappNumber ? (
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#f1e8d8]/15 px-5 text-sm font-bold text-[#f5efe3] transition hover:bg-white/[0.07]">
                Falar pelo WhatsApp
              </a>
            ) : null}
            {instagramUrl ? (
              <a href={instagramUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#f1e8d8]/15 px-5 text-sm font-bold text-[#f5efe3] transition hover:bg-white/[0.07]">
                Ver Instagram
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function ThemedDefaultHomeClient({
  reviews,
  hasMoreReviews,
  homeImages = [],
  brandName,
  addressLine,
  businessHours,
  heroImageUrl,
  heroEyebrow,
  heroTitle,
  heroSubtitle,
  primaryCtaLabel,
  secondaryCtaLabel,
  secondaryCtaHref,
  attendanceText,
  reviewsTitle,
  reviewsEmptyText,
}: HomeClientProps) {
  const image = homeImages[0] || heroImageUrl || corteImages[0];

  return (
    <main className="relative min-h-screen text-white">
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-5 sm:px-6 sm:pt-9">
        <div className="grid gap-7 lg:grid-cols-[1fr_0.95fr] lg:items-start">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--brand-strong)]">
              {heroEyebrow || "Barbearia premium"}
            </p>
            <h1 className="mt-3 max-w-[17rem] text-[1.95rem] font-semibold leading-[1.14] tracking-[-0.04em] sm:mt-5 sm:max-w-xl sm:text-5xl sm:font-bold sm:leading-tight lg:text-6xl">
              {heroTitle || "Seu estilo comeca aqui."}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-300 sm:text-base">
              {heroSubtitle ||
                `Agende seu horario com praticidade e tenha uma experiencia premium na ${brandName}.`}
            </p>
          </div>

          <div className="surface-card-strong overflow-hidden rounded-2xl p-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="relative h-[290px] overflow-hidden rounded-[20px] sm:h-[420px] lg:h-[560px]">
              {image ? (
                <Image
                  src={image}
                  alt={`Imagem principal da ${brandName}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 560px"
                  quality={92}
                  priority
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full bg-[linear-gradient(135deg,var(--brand),#020817_65%)]" />
              )}
            </div>
          </div>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/agendar"
                className="rounded-lg bg-[var(--brand)] px-6 py-3 text-center font-semibold text-white shadow-[0_12px_30px_rgba(14,165,233,0.35)] transition hover:brightness-110 active:scale-[0.98]"
              >
                {primaryCtaLabel || "Agendar horario"}
              </Link>

              <Link
                href={secondaryCtaHref || "/servicos"}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-6 py-3 text-center text-white transition hover:bg-white/[0.08] active:scale-[0.98]"
              >
                {secondaryCtaLabel || "Ver servicos"}
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="surface-card rounded-lg p-4">
                <p className="text-xs text-[var(--brand-strong)]">Local</p>
                <p className="mt-2 text-sm text-zinc-200">{addressLine}</p>
              </div>

              <div className="surface-card rounded-lg p-4">
                <p className="text-xs text-[var(--brand-strong)]">Horario</p>
                <p className="mt-2 text-sm text-zinc-200">{businessHours}</p>
              </div>

              <div className="surface-card rounded-lg p-4">
                <p className="text-xs text-[var(--brand-strong)]">Atendimento</p>
                <p className="mt-2 text-sm text-zinc-200">
                  {attendanceText || "Com hora marcada"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand-strong)]">
            Avaliacoes
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
            {reviewsTitle || "O que os clientes acharam."}
          </h2>
        </div>

        {reviews.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-5 text-sm text-zinc-400">
            {reviewsEmptyText ||
              "As avaliacoes reais dos clientes vao aparecer aqui depois dos atendimentos concluidos."}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
              >
                <p className="text-sm font-semibold text-white">
                  {formatReviewName(review.customerName)}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <CrownRating rating={review.rating} size="sm" />
                  <span className="text-xs font-semibold text-zinc-400">
                    Nota {review.rating}/5
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-300">
                  {review.comment}
                </p>
              </article>
            ))}
          </div>
        )}

        {hasMoreReviews ? (
          <div className="mt-5 flex justify-center">
            <Link
              href="/avaliacoes"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5"
            >
              Ver mais avaliacoes
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function DefaultHomeClient({
  reviews,
  hasMoreReviews,
  homeImages = [],
  brandName,
  addressLine,
  businessHours,
  heroImageUrl,
  heroEyebrow,
  heroTitle,
  heroSubtitle,
  primaryCtaLabel,
  secondaryCtaLabel,
  secondaryCtaHref,
  attendanceText,
  reviewsTitle,
  reviewsEmptyText,
}: HomeClientProps) {
  const galleryImages =
    homeImages.length > 0
      ? homeImages.slice(0, 5)
      : heroImageUrl
        ? [heroImageUrl]
        : corteImages;
  const [current, setCurrent] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [isTouching, setIsTouching] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  function nextSlide() {
    setCurrent((prev) => (prev + 1) % galleryImages.length);
  }

  function prevSlide() {
    setCurrent((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  }

  useEffect(() => {
    if (current >= galleryImages.length) {
      setCurrent(0);
    }
  }, [current, galleryImages.length]);

  useEffect(() => {
    if (isTouching) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % galleryImages.length);
    }, 4500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [galleryImages.length, isTouching]);

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    setIsTouching(true);
    setTouchEndX(null);
    setTouchStartX(event.targetTouches[0].clientX);
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    setTouchEndX(event.targetTouches[0].clientX);
  }

  function handleTouchEnd() {
    if (touchStartX === null || touchEndX === null) {
      setIsTouching(false);
      return;
    }

    const distance = touchStartX - touchEndX;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      nextSlide();
    } else if (distance < -minSwipeDistance) {
      prevSlide();
    }

    setTouchStartX(null);
    setTouchEndX(null);
    setIsTouching(false);
  }

  const defaultHeroImage = corteImages[0] || "/cortes/corte1.webp";
  const activeImage = galleryImages[current] || defaultHeroImage;
  const fallbackImage = corteImages[current % corteImages.length] || defaultHeroImage;
  const visibleImage = failedImages[activeImage] ? fallbackImage : activeImage;

  return (
    <main className="relative min-h-screen text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.12),_transparent_30%)]" />

      <section className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 sm:pt-10">
        <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div className="order-1 min-w-0 lg:col-start-1 lg:row-start-1">
            <h1 className="mt-3 max-w-[17rem] text-[1.95rem] font-semibold leading-[1.14] tracking-[-0.04em] sm:mt-5 sm:max-w-xl sm:text-5xl sm:font-bold sm:leading-tight lg:text-6xl">
              Seu estilo começa aqui.
            </h1>
          </div>

          <div className="order-3 min-w-0 lg:col-start-1 lg:row-start-2">
            <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-300 sm:text-base">
              Agende seu horário com praticidade e tenha uma experiência premium
              na {brandName}.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/agendar"
                className="rounded-lg bg-[var(--brand)] px-6 py-3 text-center font-semibold text-white shadow-[0_12px_30px_rgba(14,165,233,0.35)] transition hover:brightness-110 active:scale-[0.98]"
              >
                Agendar horário
              </Link>

              <Link
                href="/planos"
                className="rounded-lg border border-white/10 bg-white/[0.04] px-6 py-3 text-center text-white transition hover:bg-white/[0.08] active:scale-[0.98]"
              >
                Planos
              </Link>
            </div>

            <div className="mt-8 hidden gap-3 sm:grid-cols-3 lg:grid">
              <div className="surface-card rounded-lg p-4">
                <p className="text-xs text-[var(--brand-strong)]">Local</p>
                <p className="mt-2 text-sm text-zinc-200">{addressLine}</p>
              </div>

              <div className="surface-card rounded-lg p-4">
                <p className="text-xs text-[var(--brand-strong)]">Horário</p>
                <p className="mt-2 text-sm text-zinc-200">{businessHours}</p>
              </div>

              <div className="surface-card rounded-lg p-4">
                <p className="text-xs text-[var(--brand-strong)]">Atendimento</p>
                <p className="mt-2 text-sm text-zinc-200">Com hora marcada</p>
              </div>
            </div>
          </div>

          <div className="order-2 mx-auto w-full max-w-[560px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-w-none">
            <div className="relative">
              <div className="surface-card-strong relative overflow-hidden rounded-2xl p-2">
                <div
                  className="relative select-none overflow-hidden rounded-[20px]"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <div className="relative h-[290px] w-full sm:h-[360px] md:h-[420px] lg:h-[560px] xl:h-[620px]">
                    <Image
                      key={visibleImage}
                      src={visibleImage}
                      alt={`Corte ${current + 1}`}
                      fill
                      sizes="(max-width: 1024px) 100vw, 560px"
                      quality={92}
                      priority={current === 0}
                      className="object-cover transition-all duration-700 ease-out"
                      onError={() => {
                        setFailedImages((currentFailures) => ({
                          ...currentFailures,
                          [activeImage]: true,
                        }));
                      }}
                    />
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />

                  <button
                    type="button"
                    onClick={prevSlide}
                    className="absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg border border-white/10 bg-black/35 text-lg text-white backdrop-blur-xl transition hover:bg-[var(--brand-muted)] sm:left-4 sm:flex sm:h-12 sm:w-12 sm:text-xl"
                    aria-label="Foto anterior"
                  >
                    {"<"}
                  </button>

                  <button
                    type="button"
                    onClick={nextSlide}
                    className="absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg border border-white/10 bg-black/35 text-lg text-white backdrop-blur-xl transition hover:bg-[var(--brand-muted)] sm:right-4 sm:flex sm:h-12 sm:w-12 sm:text-xl"
                    aria-label="Próxima foto"
                  >
                    {">"}
                  </button>

                  <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2">
                    {galleryImages.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setCurrent(index)}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          current === index
                            ? "w-6 bg-[var(--brand)]"
                            : "w-2 bg-white/50"
                        }`}
                        aria-label={`Ver corte ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="order-4 grid gap-3 sm:grid-cols-3 lg:hidden">
            <div className="surface-card rounded-lg p-4">
              <p className="text-xs text-[var(--brand-strong)]">Local</p>
              <p className="mt-2 text-sm text-zinc-200">{addressLine}</p>
            </div>

            <div className="surface-card rounded-lg p-4">
              <p className="text-xs text-[var(--brand-strong)]">Horário</p>
              <p className="mt-2 text-sm text-zinc-200">{businessHours}</p>
            </div>

            <div className="surface-card rounded-lg p-4">
              <p className="text-xs text-[var(--brand-strong)]">Atendimento</p>
              <p className="mt-2 text-sm text-zinc-200">Com hora marcada</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <div className="mb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--brand-strong)]">
              Avaliações
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              O que os clientes acharam.
            </h2>
          </div>
        </div>

        {reviews.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.04] p-5 text-sm text-zinc-400">
            As avaliações reais dos clientes vão aparecer aqui depois dos
            atendimentos concluídos.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
              >
                <p className="text-sm font-semibold text-white">
                  {formatReviewName(review.customerName)}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <CrownRating rating={review.rating} size="sm" />
                  <span className="text-xs font-semibold text-zinc-400">
                    Nota {review.rating}/5
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-300">
                  {review.comment}
                </p>
              </article>
            ))}
          </div>
        )}

        {hasMoreReviews ? (
          <div className="mt-5 flex justify-center">
            <Link
              href="/avaliacoes"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5"
            >
              Ver mais avaliações
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}

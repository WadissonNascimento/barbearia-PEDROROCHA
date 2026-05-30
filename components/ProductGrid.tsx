"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeProductImageUrl } from "@/lib/productImageUrl";
import { formatCurrency } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  secondaryImages: {
    id: string;
    url: string;
  }[];
};

function buildProductInterestMessage(productName: string, currentUrl: string) {
  return (
    `Ola, tenho interesse na maquina ${productName}. ` +
    "Poderia me passar mais informacoes?" +
    (currentUrl ? `\n\nLink: ${currentUrl}` : "")
  );
}

export function ProductGrid({
  products,
  whatsappNumber,
}: {
  products: Product[];
  whatsappNumber: string;
}) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [secondaryIndex, setSecondaryIndex] = useState(0);
  const [currentUrl, setCurrentUrl] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setCurrentUrl(window.location.href);
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }

    setSecondaryIndex(0);
    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    const previousBodyStyles = {
      left: bodyStyle.left,
      overflow: bodyStyle.overflow,
      position: bodyStyle.position,
      right: bodyStyle.right,
      top: bodyStyle.top,
      width: bodyStyle.width,
    };
    const previousHtmlStyles = {
      overflow: htmlStyle.overflow,
      overscrollBehavior: htmlStyle.overscrollBehavior,
    };

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedProduct(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    htmlStyle.overflow = "hidden";
    htmlStyle.overscrollBehavior = "none";
    bodyStyle.left = "0";
    bodyStyle.overflow = "hidden";
    bodyStyle.position = "fixed";
    bodyStyle.right = "0";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.width = "100%";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      htmlStyle.overflow = previousHtmlStyles.overflow;
      htmlStyle.overscrollBehavior = previousHtmlStyles.overscrollBehavior;
      bodyStyle.left = previousBodyStyles.left;
      bodyStyle.overflow = previousBodyStyles.overflow;
      bodyStyle.position = previousBodyStyles.position;
      bodyStyle.right = previousBodyStyles.right;
      bodyStyle.top = previousBodyStyles.top;
      bodyStyle.width = previousBodyStyles.width;
      window.scrollTo(0, scrollY);
    };
  }, [selectedProduct]);

  const whatsappHref = useMemo(() => {
    if (!selectedProduct) {
      return null;
    }

    return buildWhatsAppUrl(
      whatsappNumber,
      buildProductInterestMessage(selectedProduct.name, currentUrl)
    );
  }, [currentUrl, selectedProduct, whatsappNumber]);

  return (
    <div className="space-y-8">
      <div className="dashboard-panel px-5 py-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">
            Catalogo disponivel
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Toque em um item para ver fotos reais, detalhes e falar com o vendedor.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product, index) => {
          const productWhatsappHref = buildWhatsAppUrl(
            whatsappNumber,
            buildProductInterestMessage(product.name, currentUrl)
          );

          return (
            <article
              key={product.id}
              className="group overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] text-left shadow-[0_16px_36px_rgba(0,0,0,0.24)] transition hover:border-[var(--brand)]/35"
            >
              <button
                type="button"
                onClick={() => setSelectedProduct(product)}
                className="relative block aspect-square w-full overflow-hidden border-b border-white/10 bg-[#edf1f7] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--brand)]/70"
                aria-label={`Ver fotos de ${product.name}`}
              >
                {normalizeProductImageUrl(product.imageUrl) ? (
                  <Image
                    src={normalizeProductImageUrl(product.imageUrl) || ""}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1280px) 50vw, 33vw"
                    quality={90}
                    priority={index < 2}
                    className="object-contain transition duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
                    Sem imagem
                  </div>
                )}
              </button>

              <div className="p-3 sm:p-4">
                <h3 className="line-clamp-2 min-h-[3rem] text-[15px] font-semibold leading-6 text-white sm:text-lg">
                  {product.name}
                </h3>
                <p className="mt-1 text-xl font-black leading-tight text-white">
                  {formatCurrency(product.price)}
                </p>

                {product.description ? (
                  <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-zinc-400 sm:text-sm">
                    {product.description}
                  </p>
                ) : (
                  <div className="mt-2 min-h-[2.5rem]" aria-hidden="true" />
                )}

                {productWhatsappHref ? (
                  <a
                    href={productWhatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex min-h-[4.5rem] w-full items-center justify-center rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand)] px-3 py-3 text-center text-[13px] font-black leading-5 text-white shadow-[0_18px_36px_rgba(14,165,233,0.25)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/70"
                  >
                    Entrar em contato com o vendedor
                  </a>
                ) : (
                  <span className="mt-3 flex min-h-[4.5rem] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center text-[13px] font-black leading-5 text-zinc-500">
                    WhatsApp indisponivel
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {selectedProduct && isMounted
        ? createPortal(
            <ProductDetailsModal
              product={selectedProduct}
              secondaryIndex={secondaryIndex}
              setSecondaryIndex={setSecondaryIndex}
              whatsappHref={whatsappHref}
              onClose={() => setSelectedProduct(null)}
            />,
            document.body
          )
        : null}
    </div>
  );
}

function ProductDetailsModal({
  product,
  secondaryIndex,
  setSecondaryIndex,
  whatsappHref,
  onClose,
}: {
  product: Product;
  secondaryIndex: number;
  setSecondaryIndex: (index: number) => void;
  whatsappHref: string | null;
  onClose: () => void;
}) {
  const mainImageUrl = normalizeProductImageUrl(product.imageUrl);
  const carouselImages = [
    ...(mainImageUrl
      ? [
          {
            id: "cover",
            url: mainImageUrl,
            alt: product.name,
            fit: "contain" as const,
          },
        ]
      : []),
    ...product.secondaryImages
      .map((image) => ({
        id: image.id,
        url: normalizeProductImageUrl(image.url) || image.url,
        alt: `Foto de ${product.name}`,
        fit: "cover" as const,
      }))
      .filter((image) => image.url),
  ];
  const currentCarouselImage =
    carouselImages[secondaryIndex] || carouselImages[0] || null;
  const hasCarouselControls = carouselImages.length > 1;

  function goToPreviousImage() {
    setSecondaryIndex(
      secondaryIndex === 0 ? carouselImages.length - 1 : secondaryIndex - 1
    );
  }

  function goToNextImage() {
    setSecondaryIndex(
      secondaryIndex >= carouselImages.length - 1 ? 0 : secondaryIndex + 1
    );
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-stretch justify-center overflow-hidden overscroll-none bg-black/85 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes de ${product.name}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-[#070a10] shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-[28px] sm:border sm:border-white/10">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/75 text-lg font-bold text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] sm:top-3 sm:h-11 sm:w-11"
          aria-label="Fechar detalhes da maquina"
        >
          X
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)]">
            <div className="p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:border-r md:border-white/10 md:p-5">
              <div className="relative h-[46dvh] min-h-[310px] max-h-[430px] overflow-hidden rounded-[24px] bg-[#edf1f7] sm:aspect-square sm:h-auto sm:max-h-none">
                {currentCarouselImage ? (
                  <Image
                    src={currentCarouselImage.url}
                    alt={currentCarouselImage.alt}
                    fill
                    sizes="(max-width: 768px) 94vw, 45vw"
                    quality={95}
                    unoptimized
                    className={
                      currentCarouselImage.fit === "contain"
                        ? "object-contain"
                        : "object-cover"
                    }
                    priority
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                    Sem imagem principal
                  </div>
                )}

                {hasCarouselControls ? (
                  <>
                    <button
                      type="button"
                      onClick={goToPreviousImage}
                      className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-lg font-bold text-white shadow-[0_10px_26px_rgba(0,0,0,0.35)]"
                      aria-label="Imagem anterior"
                    >
                      {"<"}
                    </button>
                    <button
                      type="button"
                      onClick={goToNextImage}
                      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-lg font-bold text-white shadow-[0_10px_26px_rgba(0,0,0,0.35)]"
                      aria-label="Proxima imagem"
                    >
                      {">"}
                    </button>
                  </>
                ) : null}
              </div>

              {hasCarouselControls ? (
                <div className="mt-2.5 flex justify-center gap-2">
                  {carouselImages.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setSecondaryIndex(index)}
                      className={`h-2.5 rounded-full transition ${
                        index === secondaryIndex
                          ? "w-7 bg-[var(--brand)]"
                          : "w-2.5 bg-white/30"
                      }`}
                      aria-label={`Ver foto ${index + 1}`}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="px-4 pb-4 pt-2 sm:p-6 md:pt-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--brand-strong)]">
                Detalhes da maquina
              </p>
              <h3 className="mt-1.5 text-[1.75rem] font-black leading-tight text-white sm:text-3xl">
                {product.name}
              </h3>
              <p className="mt-1 text-2xl font-black text-white">
                {formatCurrency(product.price)}
              </p>

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:mt-5 sm:p-4">
                <p className="text-sm font-bold text-white">Descricao</p>
                <p className="mt-1.5 text-sm leading-6 text-zinc-300">
                  {product.description ||
                    "Entre em contato com a barbearia para receber mais detalhes sobre esta maquina."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#070a10]/95 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-16px_40px_rgba(0,0,0,0.4)] backdrop-blur-md sm:grid sm:grid-cols-[1fr_auto] sm:gap-2 sm:p-4">
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="btn-primary w-full px-4 py-3 text-center text-sm leading-6"
            >
              Falar com o vendedor
            </a>
          ) : (
            <span className="block rounded-xl border border-white/10 px-4 py-3 text-center text-sm text-zinc-400">
              WhatsApp da barbearia nao configurado
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary hidden w-full sm:inline-flex sm:w-auto"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

import { unstable_cache } from "next/cache";
import { basePrisma } from "@/lib/prisma-core";
import { toMoneyNumber } from "@/lib/money";
import { getCurrentShop } from "@/lib/shop";
import HomeClient, {
  type HomeBarber,
  type HomeProduct,
  type HomeReview,
  type HomeService,
} from "./HomeClient";

const getHomeReviews = unstable_cache(
  async (shopId: string) =>
    basePrisma.review.findMany({
      where: {
        shopId,
        isVisible: true,
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 4,
    }),
  ["home-reviews"],
  {
    revalidate: 300,
  }
);

const getHomeImages = unstable_cache(
  async (shopId: string) =>
    basePrisma.homeImage.findMany({
      where: {
        shopId,
        isActive: true,
      },
      select: {
        imageUrl: true,
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      take: 5,
    }),
  ["home-images"],
  {
    revalidate: 300,
  }
);

const getHomePublicData = unstable_cache(
  async (shopId: string) => {
    const [services, barbers, products] = await Promise.all([
      basePrisma.service.findMany({
        where: {
          shopId,
          isActive: true,
          barberId: null,
        },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          duration: true,
        },
        orderBy: [{ name: "asc" }],
        take: 6,
      }),
      basePrisma.user.findMany({
        where: {
          shopId,
          role: "BARBER",
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          image: true,
        },
        orderBy: [{ name: "asc" }],
        take: 6,
      }),
      basePrisma.product.findMany({
        where: {
          shopId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 4,
      }),
    ]);

    return {
      services: services.map(
        (service): HomeService => ({
          id: service.id,
          name: service.name,
          description: service.description,
          price: toMoneyNumber(service.price),
          duration: service.duration,
        })
      ),
      barbers: barbers.map(
        (barber): HomeBarber => ({
          id: barber.id,
          name: barber.name || "Barbeiro",
          image: barber.image,
        })
      ),
      products: products.map(
        (product): HomeProduct => ({
          id: product.id,
          name: product.name,
          price: toMoneyNumber(product.price),
          imageUrl: product.imageUrl,
        })
      ),
    };
  },
  ["home-public-data"],
  {
    revalidate: 300,
  }
);

export default async function HomePage() {
  const shop = await getCurrentShop();
  const shopId = shop.id;
  const [reviews, images, publicData] = await Promise.all([
    getHomeReviews(shopId),
    getHomeImages(shopId),
    getHomePublicData(shopId),
  ]);

  const homeReviews: HomeReview[] = reviews.slice(0, 3).map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    customerName: review.customer.name || "Cliente",
  }));

  return (
    <HomeClient
      reviews={homeReviews}
      hasMoreReviews={reviews.length > 3}
      homeImages={images.map((image) => image.imageUrl).filter(Boolean)}
      shopId={shop.id}
      brandName={shop.name || "esta barbearia"}
      addressLine={shop.addressLine || "Endereço sob consulta"}
      businessHours={shop.businessHours || "Horário sob consulta"}
      logoPath={shop.logoPath || ""}
      whatsappNumber={shop.whatsappNumber || ""}
      instagramUrl={shop.instagramUrl || ""}
      services={publicData.services}
      barbers={publicData.barbers}
      products={publicData.products}
      heroImageUrl={shop.heroImageUrl || ""}
      heroEyebrow={shop.heroEyebrow || ""}
      heroTitle={shop.heroTitle || ""}
      heroSubtitle={shop.heroSubtitle || ""}
      primaryCtaLabel={shop.primaryCtaLabel || ""}
      secondaryCtaLabel={shop.secondaryCtaLabel || ""}
      secondaryCtaHref={shop.secondaryCtaHref || ""}
      attendanceText={shop.attendanceText || ""}
      reviewsTitle={shop.reviewsTitle || ""}
      reviewsEmptyText={shop.reviewsEmptyText || ""}
    />
  );
}

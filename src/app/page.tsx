import { redirect } from "next/navigation";
import { shop } from "@/data/demo";

export default function Home() {
  redirect(`/${shop.slug}`);
}

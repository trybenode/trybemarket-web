"use client";

import Link from "next/link";
import { Package, Briefcase, ArrowRight, Users, LayoutList, TrendingUp, Store } from "lucide-react";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const options = [
  {
    id: 1,
    name: "List a product",
    description: "Sell physical items, gadgets or goods to students on your campus.",
    icon: Package,
    tone: "bg-blue-50 text-primary",
    route: "/product-upload",
  },
  {
    id: 2,
    name: "List a service",
    description: "Offer your skills — tutoring, design, writing, repairs and more.",
    icon: Briefcase,
    tone: "bg-brand-yellow text-slate-900",
    route: "/service-upload",
    badge: "Beta",
  },
];

const benefits = [
  { icon: Users, title: "Reach students", text: "Connect with campus communities nationwide." },
  { icon: LayoutList, title: "Easy management", text: "Simple tools to upload and track your listings." },
  { icon: TrendingUp, title: "Grow your business", text: "Premium features to boost visibility and sales." },
];

export default function Upload() {
  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Header title="List your hustle" />

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Hero */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
            What would you like to list?
          </h1>
          <p className="mt-2 text-slate-600">Choose how you want to showcase your business.</p>
        </div>

        {/* Options */}
        <div className="grid gap-4 md:grid-cols-2">
          {options.map(({ id, name, description, icon: Icon, tone, route, badge }) => (
            <Link
              key={id}
              href={route}
              className="group relative flex items-start gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:scale-[0.99] md:flex-col md:gap-0 md:p-6"
            >
              {badge && (
                <Badge variant="brand" className="absolute right-3 top-3 md:right-4 md:top-4">
                  {badge}
                </Badge>
              )}
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl md:mb-4 md:h-14 md:w-14 ${tone}`}>
                <Icon className="h-6 w-6 md:h-7 md:w-7" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-slate-900 md:text-xl">{name}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
                <span className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary md:mt-5">
                  Get started
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Why list */}
        <div className="mt-10">
          <h3 className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-slate-500">
            Why list on TrybeMarket?
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {benefits.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:block">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-yellow-soft text-amber-700 sm:mb-3">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Already listed something */}
        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-slate-500">Already have listings?</p>
          <Button asChild variant="soft">
            <Link href="/my-shop">
              <Store /> Manage them in My Shop
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

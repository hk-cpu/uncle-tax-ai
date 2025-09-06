import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useState } from "react";

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [ctaLoading, setCtaLoading] = useState<string | null>(null);

  const plans = [
    {
      name: "Starter",
      monthly: 0,
      yearly: 0,
      description: "For trying UNCLE",
      features: ["Up to 50 transactions/mo", "Basic reports", "Email support"],
      cta: "Get Started",
      tag: "Free",
      recommended: false,
    },
    {
      name: "Pro",
      monthly: 9,
      yearly: 90,
      description: "For growing shops",
      features: ["Unlimited transactions", "Advanced reports", "Priority support"],
      cta: "Start Free Trial",
      recommended: true,
      tag: "Most Popular",
    },
    {
      name: "Business",
      monthly: 29,
      yearly: 290,
      description: "For multi-store owners",
      features: ["All Pro features", "Team access", "Dedicated support"],
      cta: "Contact Sales",
      tag: "Best Value",
      recommended: false,
    },
  ] as const;

  const currency = (plan: (typeof plans)[number]) =>
    billing === "monthly" ? `$${plan.monthly}` : `$${plan.yearly}`;
  const per = billing === "monthly" ? "/mo" : "/yr";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-white"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Pricing</h1>
          <p className="text-gray-600 mt-3">
            Simple, transparent plans that scale with your business.
          </p>
        </div>

        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center rounded-full border bg-gray-50 p-1">
            <button
              className={`px-4 py-2 text-sm rounded-full ${
                billing === "monthly" ? "bg-white border shadow-sm" : "text-gray-600"
              }`}
              onClick={() => setBilling("monthly")}
            >
              Monthly
            </button>
            <button
              className={`px-4 py-2 text-sm rounded-full ${
                billing === "yearly" ? "bg-white border shadow-sm" : "text-gray-600"
              }`}
              onClick={() => setBilling("yearly")}
              title="Save with annual billing"
            >
              Yearly <span className="ml-1 text-xs text-green-600">(save 20%)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 * idx }}
            >
              <Card
                className={`h-full ${
                  plan.recommended ? "border-blue-600 ring-1 ring-blue-50" : ""
                }`}
              >
                <CardHeader className="relative">
                  {plan.tag && (
                    <span
                      className={`absolute -top-3 right-6 text-xs px-2 py-1 rounded-full ${
                        plan.recommended ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {plan.tag}
                    </span>
                  )}
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-gray-900">
                      {currency(plan)}
                    </span>
                    <span className="text-gray-500">{per}</span>
                  </div>

                  <ul className="space-y-2 text-sm text-gray-700">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full ${
                      plan.recommended ? "bg-blue-600 hover:bg-blue-700" : ""
                    }`}
                    variant={plan.recommended ? "default" : "outline"}
                    onClick={async () => {
                      setCtaLoading(plan.name);
                      try {
                        navigate(isAuthenticated ? "/dashboard" : "/auth");
                      } finally {
                        setCtaLoading(null);
                      }
                    }}
                    disabled={ctaLoading === plan.name}
                  >
                    {ctaLoading === plan.name ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isAuthenticated ? "Opening Dashboard…" : "Starting…"}
                      </>
                    ) : (
                      <>
                        {plan.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-sm text-gray-500">
            All prices in USD. Taxes may apply based on your country.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
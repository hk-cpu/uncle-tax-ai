import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Check, Crown, Shield, Star } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

type BillingCycle = "monthly" | "annual";

export default function Pricing() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const price = (monthly: number) => (cycle === "monthly" ? monthly : Math.round(monthly * 12 * 0.8)); // 20% off yearly

  const plans = [
    {
      key: "starter",
      name: "Starter",
      icon: Star,
      price: price(0),
      description: "For trying UNCLE and small shops getting started.",
      features: ["WhatsApp parsing", "Manual entries", "Basic CSV export"],
      cta: isAuthenticated ? "Included" : "Start Free",
      highlight: false,
    },
    {
      key: "pro",
      name: "Pro",
      icon: Crown,
      price: price(9),
      description: "For growing shops that need automation and reports.",
      features: ["Auto tax calc (IN/SA)", "Unlimited entries", "PDF & CSV exports", "Priority support"],
      cta: isAuthenticated ? "Go to Dashboard" : "Upgrade & Start",
      highlight: true,
    },
    {
      key: "business",
      name: "Business",
      icon: Shield,
      price: price(29),
      description: "For multi-location stores and advanced controls.",
      features: ["Multi-user", "Advanced reports", "Role-based access", "SLA support"],
      cta: isAuthenticated ? "Contact Sales" : "Contact Sales",
      highlight: false,
    },
  ] as const;

  const handleCta = (plan: (typeof plans)[number]) => {
    if (plan.key === "business") {
      window.open("mailto:hello@vly.ai?subject=UNCLE%20Business%20Plan%20Inquiry", "_blank");
      return;
    }
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      navigate("/auth");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-white"
    >
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://harmless-tapir-303.convex.cloud/api/storage/bcbdad4d-5195-48b1-9334-b7c21a475144"
              alt="UNCLE logo"
              className="h-9 w-auto rounded-md cursor-pointer"
              onClick={() => navigate("/")}
            />
            <span className="text-lg font-semibold">Pricing</span>
          </div>
          <Button variant="outline" onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}>
            {isAuthenticated ? "Dashboard" : "Sign in"}
          </Button>
        </div>
      </header>

      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <motion.h1
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-4xl font-bold text-gray-900 mb-3"
            >
              Simple, transparent pricing
            </motion.h1>
            <p className="text-gray-600">Choose a plan that grows with your shop.</p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-lg border p-1">
              <Button
                variant={cycle === "monthly" ? "default" : "ghost"}
                onClick={() => setCycle("monthly")}
                className="h-9"
              >
                Monthly
              </Button>
              <Button
                variant={cycle === "annual" ? "default" : "ghost"}
                onClick={() => setCycle("annual")}
                className="h-9"
              >
                Annual <span className="ml-2 text-xs text-green-600">Save 20%</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, idx) => (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * idx }}
              >
                <Card className={`relative h-full hover:shadow-md transition ${plan.highlight ? "border-blue-600 ring-1 ring-blue-100" : ""}`}>
                  {plan.highlight && (
                    <div className="absolute -top-3 right-4 bg-blue-600 text-white text-xs px-2 py-1 rounded-md shadow">
                      Most popular
                    </div>
                  )}
                  <CardHeader className="space-y-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${plan.highlight ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-700"}`}>
                      <plan.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-bold text-gray-900">
                        {plan.price === 0 ? "Free" : (plan.price).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                      </span>
                      {plan.price !== 0 && (
                        <span className="text-gray-500 mb-1">/{cycle === "monthly" ? "mo" : "yr"}</span>
                      )}
                    </div>

                    <ul className="space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                          <Check className="h-4 w-4 text-green-600" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Button
                      className={`w-full ${plan.highlight ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                      onClick={() => handleCta(plan)}
                      disabled={isLoading}
                    >
                      {plan.cta}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 text-center text-sm text-gray-500">
            Prices shown in USD. Localized taxes (GST/VAT) calculated automatically in-app.
          </div>
        </div>
      </section>
    </motion.div>
  );
}
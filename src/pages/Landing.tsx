import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { 
  Calculator, 
  MessageSquare, 
  FileText, 
  Shield, 
  Globe, 
  Zap,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const features = [
    {
      icon: MessageSquare,
      title: "WhatsApp Integration",
      description: "Send transactions via WhatsApp messages. Just text 'Sold 5 items for ₹500' and we'll handle the rest."
    },
    {
      icon: Calculator,
      title: "Smart Tax Calculation",
      description: "Automatic GST and VAT calculations for India and Saudi Arabia with real-time tax liability tracking."
    },
    {
      icon: FileText,
      title: "Instant Reports",
      description: "Generate professional tax reports in PDF and Excel formats with one click."
    },
    {
      icon: Shield,
      title: "Secure & Compliant",
      description: "Bank-grade security with full compliance to Indian and Saudi tax regulations."
    },
    {
      icon: Globe,
      title: "Multi-Country Support",
      description: "Built for shopkeepers in India (GST) and Saudi Arabia (VAT) with localized features."
    },
    {
      icon: Zap,
      title: "AI-Powered",
      description: "Advanced AI understands your business language and categorizes transactions automatically."
    }
  ];

  const benefits = [
    "Save 5+ hours weekly on bookkeeping",
    "Reduce tax filing errors by 95%",
    "Never miss a tax deadline again",
    "Get instant business insights",
    "Works in Hindi, Arabic, and English"
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
    >
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl">
                <Calculator className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent cursor-pointer" onClick={() => navigate("/")}>
                UNCLE
              </span>
            </div>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-6">
              <a href="#hero" className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                Hero
              </a>
              <a href="#features" className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                Features
              </a>
              <a href="#benefits" className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                Benefits
              </a>
              {isLoading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              ) : isAuthenticated ? (
                <Button onClick={() => navigate("/dashboard")} className="bg-gradient-to-r from-blue-600 to-purple-600">
                  Dashboard
                </Button>
              ) : (
                <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-blue-600 to-purple-600">
                  Get Started
                </Button>
              )}
            </div>

            {/* Mobile Menu */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl">
                        <Calculator className="h-5 w-5 text-white" />
                      </div>
                      UNCLE
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 flex flex-col gap-3">
                    <a href="#hero" className="text-base text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400">
                      Hero
                    </a>
                    <a href="#features" className="text-base text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400">
                      Features
                    </a>
                    <a href="#benefits" className="text-base text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400">
                      Benefits
                    </a>
                    <div className="pt-4">
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      ) : isAuthenticated ? (
                        <Button onClick={() => navigate("/dashboard")} className="w-full bg-gradient-to-r from-blue-600 to-purple-600">
                          Dashboard
                        </Button>
                      ) : (
                        <Button onClick={() => navigate("/auth")} className="w-full bg-gradient-to-r from-blue-600 to-purple-600">
                          Get Started
                        </Button>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="hero" className="relative overflow-hidden py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              {/* Added acronym expansion */}
              <p className="text-sm md:text-base text-blue-600/80 dark:text-blue-300/80 tracking-wide uppercase mb-2">
                UNCLE — Unified Numbers, Compliance & Ledger Engine
              </p>
              <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-6">
                Your AI Tax Assistant
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
                UNCLE makes tax management effortless for shopkeepers. Send transactions via WhatsApp, 
                get instant tax calculations, and generate professional reports.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
            >
              <Button 
                size="lg" 
                onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg px-8 py-6"
              >
                {isAuthenticated ? "Go to Dashboard" : "Start Free Trial"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-6 border-2"
              >
                Watch Demo
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="relative"
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-4xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="bg-green-100 dark:bg-green-900 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <MessageSquare className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="font-semibold mb-2">Send via WhatsApp</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      "Sold 5 items for ₹500"
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Calculator className="h-8 w-8 text-blue-600" />
                    </div>
                    <h3 className="font-semibold mb-2">AI Processes</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Automatic categorization & tax calculation
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="bg-purple-100 dark:bg-purple-900 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <FileText className="h-8 w-8 text-purple-600" />
                    </div>
                    <h3 className="font-semibold mb-2">Get Reports</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Professional tax reports instantly
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white/50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Powerful features designed specifically for small business owners
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow duration-300">
                  <CardHeader>
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-3 rounded-lg w-fit">
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
                Why Shopkeepers Love UNCLE
              </h2>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + 0.1 * index }}
                    className="flex items-center space-x-3"
                  >
                    <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                    <span className="text-lg text-gray-700 dark:text-gray-300">{benefit}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="relative"
            >
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
                <p className="text-blue-100 mb-6">
                  Join thousands of shopkeepers who have simplified their tax management with UNCLE.
                </p>
                <Button 
                  size="lg" 
                  onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
                  className="bg-white text-blue-600 hover:bg-gray-100 w-full"
                >
                  {isAuthenticated ? "Go to Dashboard" : "Start Your Free Trial"}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl">
                <Calculator className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold">UNCLE</span>
            </div>
            <p className="text-gray-400 mb-4">
              Your AI Tax Assistant for Effortless Business Management
            </p>
            <p className="text-sm text-gray-500">
              Built with ❤️ for shopkeepers in India and Saudi Arabia
            </p>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { motion } from "framer-motion";
import { 
  Calculator, 
  MessageSquare, 
  Plus, 
  TrendingUp, 
  TrendingDown,
  Receipt,
  BarChart3,
  Loader2
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const [selectedCountry, setSelectedCountry] = useState<"IN" | "SA">("IN");
  const [exporting, setExporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [verifyToken, setVerifyToken] = useState("change-me-secure-token");
  const [phoneInput, setPhoneInput] = useState(user?.phoneNumber ?? "");
  const updateWhatsAppConnection = useMutation(api.users.updateWhatsAppConnection);
  
  const transactions = useQuery(api.transactions.list, { 
    limit: 10, 
    country: selectedCountry 
  });
  
  const taxSummary = useQuery(api.transactions.getTaxSummary, { 
    country: selectedCountry 
  });
  
  const createTransaction = useMutation(api.transactions.create);
  
  const [newTransaction, setNewTransaction] = useState({
    amount: "",
    description: "",
    type: "income" as "income" | "expense",
    category: "",
  });

  // Add CSV export helper
  const exportCsv = async () => {
    try {
      setExporting(true);
      const rows = (transactions ?? []).map((t) => ({
        Date: new Date(t._creationTime).toISOString(),
        Type: t.type,
        Amount: t.amount,
        Currency: selectedCountry === "IN" ? "INR" : "SAR",
        TaxRate: t.taxRate ?? 0,
        TaxAmount: t.taxAmount ?? 0,
        NetAmount: t.netAmount,
        Category: t.category,
        Description: t.description,
        Country: t.country,
      }));
      if (!rows.length) {
        toast.info("No transactions to export.");
        return;
      }
      const headers = Object.keys(rows[0] as Record<string, unknown>);
      const csv = [
        headers.join(","),
        ...rows.map((r) =>
          headers
            .map((h) => {
              const v = (r as Record<string, unknown>)[h];
              const s = typeof v === "string" ? v : String(v ?? "");
              return `"${s.replace(/"/g, '""')}"`;
            })
            .join(","),
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 10);
      a.download = `uncle-transactions-${selectedCountry}-${ts}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported.");
    } finally {
      setExporting(false);
    }
  };

  // Helper: copy to clipboard with feedback
  const copy = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label ?? "Copied"} to clipboard`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const webhookUrl = `${(import.meta as any).env.VITE_CONVEX_URL?.replace(/\/$/, "") ?? "https://YOUR-CONVEX-URL"}/webhooks/whatsapp`;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleAddTransaction = async () => {
    if (!newTransaction.amount || !newTransaction.description) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      setAdding(true);
      await createTransaction({
        amount: parseFloat(newTransaction.amount),
        description: newTransaction.description,
        type: newTransaction.type,
        category: newTransaction.category || "general",
        country: selectedCountry,
        taxRate: newTransaction.type === "income" ? 18 : 0,
      });

      setNewTransaction({
        amount: "",
        description: "",
        type: "income",
        category: "",
      });

      toast.success("Transaction added successfully!");
    } catch (error) {
      toast.error("Failed to add transaction");
    } finally {
      setAdding(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800"
    >
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Calculator className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  UNCLE Dashboard
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Welcome back, {user?.name || "Shopkeeper"}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value as "IN" | "SA")}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="IN">🇮🇳 India</option>
                <option value="SA">🇸🇦 Saudi Arabia</option>
              </select>
              <Button variant="outline" onClick={exportCsv} disabled={exporting}>
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting…
                  </>
                ) : (
                  "Export CSV"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Total Income</p>
                    <p className="text-2xl font-bold">
                      {selectedCountry === "IN" ? "₹" : "﷼"}{taxSummary?.totalIncome?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-100" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-100 text-sm font-medium">Total Expenses</p>
                    <p className="text-2xl font-bold">
                      {selectedCountry === "IN" ? "₹" : "﷼"}{taxSummary?.totalExpenses?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-100" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Tax Liability</p>
                    <p className="text-2xl font-bold">
                      {selectedCountry === "IN" ? "₹" : "﷼"}{taxSummary?.totalTax?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <Receipt className="h-8 w-8 text-blue-100" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Net Profit</p>
                    <p className="text-2xl font-bold">
                      {selectedCountry === "IN" ? "₹" : "﷼"}{taxSummary?.netProfit?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-purple-100" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Transaction */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Plus className="h-5 w-5" />
                  <span>Add Transaction</span>
                </CardTitle>
                <CardDescription>
                  Record a new income or expense
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Button
                    variant={newTransaction.type === "income" ? "default" : "outline"}
                    onClick={() => setNewTransaction(prev => ({ ...prev, type: "income" }))}
                    className="flex-1"
                  >
                    Income
                  </Button>
                  <Button
                    variant={newTransaction.type === "expense" ? "default" : "outline"}
                    onClick={() => setNewTransaction(prev => ({ ...prev, type: "expense" }))}
                    className="flex-1"
                  >
                    Expense
                  </Button>
                </div>
                
                <Input
                  placeholder="Amount"
                  type="number"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: e.target.value }))}
                />
                
                <Input
                  placeholder="Description"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, description: e.target.value }))}
                />
                
                <Input
                  placeholder="Category (optional)"
                  value={newTransaction.category}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, category: e.target.value }))}
                />
                
                <Button onClick={handleAddTransaction} className="w-full" disabled={adding}>
                  {adding ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    "Add Transaction"
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Transactions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>
                  Your latest financial activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transactions?.map((transaction) => (
                    <div
                      key={transaction._id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${
                          transaction.type === "income" 
                            ? "bg-green-100 text-green-600" 
                            : "bg-red-100 text-red-600"
                        }`}>
                          {transaction.type === "income" ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{transaction.description}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {transaction.category}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${
                          transaction.type === "income" ? "text-green-600" : "text-red-600"
                        }`}>
                          {transaction.type === "income" ? "+" : "-"}
                          {selectedCountry === "IN" ? "₹" : "﷼"}{transaction.amount.toLocaleString()}
                        </p>
                        {transaction.taxAmount && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Tax: {selectedCountry === "IN" ? "₹" : "﷼"}{transaction.taxAmount.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {!transactions?.length && (
                    <div className="text-center py-8 text-gray-500">
                      No transactions yet. Add your first transaction above!
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* WhatsApp Integration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-8"
        >
          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <MessageSquare className="h-8 w-8" />
                  <div>
                    <h3 className="text-xl font-bold">WhatsApp Integration</h3>
                    <p className="text-green-100">
                      Send transactions via WhatsApp: "Sold 5 items for ₹500"
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="bg-white text-green-600 hover:bg-gray-100"
                  onClick={() => setShowConnect(true)}
                >
                  Connect WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Connect WhatsApp Dialog */}
        <Dialog open={showConnect} onOpenChange={setShowConnect}>
          <DialogContent showCloseButton>
            <DialogHeader>
              <DialogTitle>Connect WhatsApp</DialogTitle>
              <DialogDescription>
                Enable WhatsApp Cloud API to receive and reply to messages automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {user?.whatsappConnected ? (
                <div className="rounded-md bg-green-50 text-green-700 border border-green-200 p-3 text-sm">
                  Connected to {user.phoneNumber || "unknown number"}
                </div>
              ) : (
                <div className="rounded-md bg-yellow-50 text-yellow-700 border border-yellow-200 p-3 text-sm">
                  Not connected yet
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">Your WhatsApp phone number</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 919812345678 (E.164 format, no +)"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                  />
                  <Button
                    onClick={async () => {
                      try {
                        if (!phoneInput.trim()) {
                          toast.error("Enter your phone number");
                          return;
                        }
                        await updateWhatsAppConnection({
                          phoneNumber: phoneInput.trim(),
                          connected: true,
                        });
                        toast.success("Saved and linked your WhatsApp transactions");
                      } catch (e) {
                        toast.error("Failed to save phone number");
                      }
                    }}
                  >
                    Save & Link
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Use E.164 without the +. Example: 14155552671 (US), 919812345678 (IN), 9665XXXXXXXX (SA)
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-900">1) Add your webhook to Meta</p>
                <ol className="mt-2 list-decimal list-inside text-sm text-gray-700 space-y-1">
                  <li>Go to Meta Business → WhatsApp → API Setup</li>
                  <li>Set Callback URL and Verify Token (below), then Subscribe to messages + message status</li>
                </ol>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">Callback URL</label>
                <div className="flex gap-2">
                  <Input readOnly value={webhookUrl} />
                  <Button
                    variant="outline"
                    onClick={() => copy(webhookUrl, "Callback URL")}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  This endpoint is already live in your backend.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">Verify Token</label>
                <div className="flex gap-2">
                  <Input
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    onClick={() => copy(verifyToken, "Verify token")}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Use the same value in both Meta and your Convex env variable WHATSAPP_VERIFY_TOKEN.
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-900">2) Set environment variables</p>
                <ul className="mt-2 text-sm text-gray-700 space-y-1">
                  <li>WHATSAPP_VERIFY_TOKEN = your verify token above</li>
                  <li>WHATSAPP_TOKEN = your permanent access token</li>
                  <li>WHATSAPP_PHONE_NUMBER_ID = your WhatsApp phone number ID</li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  Set these in Convex → Environment Variables. After saving, send a test message from Meta.
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-900">3) Test</p>
                <ul className="mt-2 text-sm text-gray-700 space-y-1">
                  <li>Send "Sold 3 items for ₹1,250" to your number</li>
                  <li>Try "balance" and "undo" commands</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConnect(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </motion.div>
  );
}
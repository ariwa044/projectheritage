import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, ArrowUpCircle, ArrowDownCircle, Filter } from "lucide-react";
import { format } from "date-fns";
import type { User } from "@supabase/supabase-js";

interface Transaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  recipient: string | null;
  status: string;
  created_at: string;
}

const TransactionHistory = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("newest");

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      loadTransactions(session.user.id);
    };
    checkUser();
  }, [navigate]);

  // Real-time subscription for transaction updates (handles admin edits and deletions)
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase.channel('tx-history-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'transactions',
    }, (payload: any) => {
      // Reload transactions to catch admin edits and deletions
      loadTransactions(user.id);
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'transfers',
    }, (payload: any) => {
      // Only reload if this transfer affects the current user
      if (payload.new?.user_id === user.id || payload.old?.user_id === user.id) {
        loadTransactions(user.id);
      }
    })
    .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadTransactions = async (userId: string) => {
    try {
      console.log("[TransactionHistory] Loading transactions for user:", userId);
      let allTransactions: Transaction[] = [];

      // Fetch from transactions table via accounts
      const { data: accounts, error: accountsError } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", userId);

      console.log("[TransactionHistory] Accounts found:", accounts?.length || 0, accountsError ? `Error: ${accountsError.message}` : "");

      if (accounts && accounts.length > 0) {
        const accountIds = accounts.map((acc) => acc.id);
        const { data: txns, error: txnError } = await supabase
          .from("transactions")
          .select("*")
          .in("account_id", accountIds)
          .order("created_at", { ascending: false });

        console.log("[TransactionHistory] Transactions from 'transactions' table:", txns?.length || 0, txnError ? `Error: ${txnError.message}` : "");
        if (txns && txns.length > 0) {
          console.log("[TransactionHistory] Sample transaction statuses:", txns.slice(0, 5).map(t => ({ id: t.id.slice(0, 8), status: t.status, desc: t.description })));
          allTransactions = txns;
        }
      }

      // Also fetch from transfers table (admin edits update this table)
      const { data: transfers, error: transfersError } = await supabase
        .from("transfers")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      console.log("[TransactionHistory] Transfers from 'transfers' table:", transfers?.length || 0, transfersError ? `Error: ${transfersError.message}` : "");

      if (transfers && transfers.length > 0) {
        console.log("[TransactionHistory] Sample transfer statuses:", transfers.slice(0, 5).map(t => ({ id: t.id.slice(0, 8), status: t.status, recipient: t.recipient_name })));
        const mappedTransfers: Transaction[] = transfers.map((t) => ({
          id: t.id,
          amount: t.amount,
          transaction_type: "debit",
          description: `${t.transfer_type} transfer to ${t.recipient_name}`,
          recipient: t.recipient_name,
          status: t.status,
          created_at: t.created_at,
        }));
        allTransactions = [...allTransactions, ...mappedTransfers];
      }

      // NOTE: Direct status updates are currently blocked by RLS for admins.
      // Changes made in the Admin panel will only be visible there via admin_logs.
      // A SQL policy update or Edge Function with service_role is required for client visibility.

      // Sort by date descending
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      console.log("[TransactionHistory] Final transactions count:", allTransactions.length);
      console.log("[TransactionHistory] All statuses:", allTransactions.map(t => ({ id: t.id.slice(0, 8), status: t.status })));

      setTransactions(allTransactions);
      setFilteredTransactions(allTransactions);
      setLoading(false);
    } catch (error) {
      console.error("[TransactionHistory] Error loading transactions:", error);
      setLoading(false);
    }
  };

  // Filter and sort transactions
  useEffect(() => {
    let filtered = [...transactions];

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter(t => t.transaction_type === filterType);
    }

    // Apply sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    setFilteredTransactions(filtered);
  }, [transactions, filterType, sortOrder]);

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowReceipt(true);
  };

  const downloadReceipt = () => {
    if (!selectedTransaction) return;
    
    const receiptContent = `
HERITAGE BANK
Transaction Receipt
-------------------
Reference: ${selectedTransaction.id.substring(0, 8).toUpperCase()}
Date: ${format(new Date(selectedTransaction.created_at), 'PPpp')}
Type: ${selectedTransaction.transaction_type.toUpperCase()}
Amount: $${selectedTransaction.amount.toFixed(2)}
${selectedTransaction.recipient ? `Recipient: ${selectedTransaction.recipient}` : ''}
Description: ${selectedTransaction.description || 'N/A'}
Status: ${selectedTransaction.status.toUpperCase()}
-------------------
Thank you for banking with us.
    `;

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${selectedTransaction.id.substring(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-primary">
      <Navbar />
      <div className="pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <Button onClick={() => navigate("/dashboard")} variant="ghost" className="mb-4 text-sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Button>

          <div className="mb-8">
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-4">Transactions</h1>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      <SelectValue placeholder="Filter by type" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Transactions</SelectItem>
                    <SelectItem value="credit">Credits Only</SelectItem>
                    <SelectItem value="debit">Debits Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1 min-w-[200px]">
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {loading ? (
            <Card className="p-4 sm:p-8 text-center">
              <p className="text-sm sm:text-base text-muted-foreground">Loading...</p>
            </Card>
          ) : filteredTransactions.length === 0 ? (
            <Card className="p-4 sm:p-8 text-center">
              <p className="text-sm sm:text-base text-muted-foreground">
                {transactions.length === 0 
                  ? "No transactions" 
                  : "No transactions match your filters"}
              </p>
            </Card>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {filteredTransactions.map((transaction) => (
                <Card
                  key={transaction.id}
                  className="p-3 sm:p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => handleTransactionClick(transaction)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className={`p-1.5 sm:p-2 rounded-full flex-shrink-0 ${
                        transaction.transaction_type === 'debit' || transaction.transaction_type === 'transfer'
                          ? 'bg-destructive/10'
                          : 'bg-green-500/10'
                      }`}>
                        {transaction.transaction_type === 'debit' || transaction.transaction_type === 'transfer' ? (
                          <ArrowUpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                        ) : (
                          <ArrowDownCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm sm:text-base truncate">
                          {transaction.description || transaction.transaction_type.toUpperCase()}
                        </p>
                        {transaction.recipient && (
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {transaction.recipient}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(transaction.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold text-sm sm:text-base ${
                        transaction.transaction_type === 'debit' || transaction.transaction_type === 'transfer'
                          ? 'text-destructive'
                          : 'text-green-500'
                      }`}>
                        {transaction.transaction_type === 'debit' || transaction.transaction_type === 'transfer' ? '-' : '+'}
                        ${transaction.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{transaction.status}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Receipt</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-3 sm:space-y-4">
              <div className="text-center py-3 sm:py-4 border-b">
                <h3 className="text-lg sm:text-xl font-bold">Heritage Bank</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">Transaction Receipt</p>
              </div>
              
              <div className="space-y-2 sm:space-y-3 text-sm sm:text-base">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground text-xs sm:text-sm">Ref:</span>
                  <span className="font-mono text-xs sm:text-sm">{selectedTransaction.id.substring(0, 8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground text-xs sm:text-sm">Date:</span>
                  <span className="text-xs sm:text-sm">{format(new Date(selectedTransaction.created_at), 'MMM d, yyyy h:mm a')}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground text-xs sm:text-sm">Type:</span>
                  <span className="capitalize text-xs sm:text-sm">{selectedTransaction.transaction_type}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground text-xs sm:text-sm">Amount:</span>
                  <span className={`font-bold text-sm sm:text-base ${
                    selectedTransaction.transaction_type === 'debit' || selectedTransaction.transaction_type === 'transfer'
                      ? 'text-destructive'
                      : 'text-green-500'
                  }`}>
                    {selectedTransaction.transaction_type === 'debit' || selectedTransaction.transaction_type === 'transfer' ? '-' : '+'}
                    ${selectedTransaction.amount.toFixed(2)}
                  </span>
                </div>
                {selectedTransaction.recipient && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground text-xs sm:text-sm">To:</span>
                    <span className="text-xs sm:text-sm text-right break-all">{selectedTransaction.recipient}</span>
                  </div>
                )}
                {selectedTransaction.description && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground text-xs sm:text-sm">Note:</span>
                    <span className="text-xs sm:text-sm text-right break-words">{selectedTransaction.description}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground text-xs sm:text-sm">Status:</span>
                  <span className="capitalize text-xs sm:text-sm">{selectedTransaction.status}</span>
                </div>
              </div>

              <div className="pt-3 sm:pt-4 border-t text-center text-xs sm:text-sm text-muted-foreground">
                Thank you for banking with us
              </div>

              <Button onClick={downloadReceipt} className="w-full text-sm" variant="outline" size="sm">
                <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                Download
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransactionHistory;

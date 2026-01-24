import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Transaction {
  id: string;
  account_id: string;
  amount: number;
  description: string | null;
  transaction_type: string;
  recipient: string | null;
  status: string | null;
  created_at: string | null;
}

export const EditTransactions = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRecipient, setEditRecipient] = useState("");
  const [editDateTime, setEditDateTime] = useState("");
  const [editStatus, setEditStatus] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadUserTransactions(selectedUser);
    }
  }, [selectedUser]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name");

    setUsers(data || []);
  };

  const loadUserTransactions = async (userId: string) => {
    // Get user's accounts first
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", userId);

    if (!accounts || accounts.length === 0) {
      setTransactions([]);
      return;
    }

    const accountIds = accounts.map(acc => acc.id);

    // Get transactions for these accounts
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .in("account_id", accountIds)
      .order("created_at", { ascending: false });

    setTransactions(data || []);
  };

  const openEditDialog = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setEditAmount(transaction.amount.toString());
    setEditDescription(transaction.description || "");
    setEditRecipient(transaction.recipient || "");
    setEditDateTime(transaction.created_at ? new Date(transaction.created_at).toISOString().slice(0, 16) : "");
    setEditStatus(transaction.status || "completed");
    setShowEditDialog(true);
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          amount: parseFloat(editAmount),
          description: editDescription,
          recipient: editRecipient,
          created_at: new Date(editDateTime).toISOString(),
          status: editStatus,
        })
        .eq("id", editingTransaction.id);

      if (error) throw error;

      // Log the action
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("admin_logs").insert({
          admin_id: user.id,
          action_type: "edit_transaction",
          target_user_id: selectedUser,
          details: {
            transaction_id: editingTransaction.id,
            changes: {
              amount: parseFloat(editAmount),
              description: editDescription,
              recipient: editRecipient,
              created_at: editDateTime,
              status: editStatus,
            }
          },
        });
      }

      toast({
        title: "Success",
        description: "Transaction updated successfully",
      });

      setShowEditDialog(false);
      await loadUserTransactions(selectedUser);
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast({
        title: "Error",
        description: "Failed to update transaction",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId);

      if (error) throw error;

      // Log the action
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("admin_logs").insert({
          admin_id: user.id,
          action_type: "delete_transaction",
          target_user_id: selectedUser,
          details: { transaction_id: transactionId },
        });
      }

      toast({
        title: "Success",
        description: "Transaction deleted successfully",
      });

      await loadUserTransactions(selectedUser);
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast({
        title: "Error",
        description: "Failed to delete transaction",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Transactions</h1>
        <p className="text-muted-foreground">Edit transaction details and timestamps</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Search User</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label>User</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {filteredUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedUser && (
        <Card>
          <CardHeader>
            <CardTitle>User Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No transactions found for this user</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-semibold px-2 py-1 rounded ${
                          transaction.transaction_type === 'credit' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {transaction.transaction_type.toUpperCase()}
                        </span>
                        <span className="text-lg font-bold">
                          ${Number(transaction.amount).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {transaction.recipient && `To: ${transaction.recipient} • `}
                        {transaction.created_at && new Date(transaction.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(transaction)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteTransaction(transaction.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label>Recipient</Label>
              <Input
                value={editRecipient}
                onChange={(e) => setEditRecipient(e.target.value)}
                placeholder="Recipient name"
              />
            </div>
            <div>
              <Label>Date & Time</Label>
              <Input
                type="datetime-local"
                value={editDateTime}
                onChange={(e) => setEditDateTime(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTransaction} disabled={loading}>
              {loading ? "Updating..." : "Update Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
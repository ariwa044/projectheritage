import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  authorization_code_required: boolean;
}

export const AuthorizationCodeToggle = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, authorization_code_required")
      .order("full_name");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
      console.error(error);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const handleToggle = async (userId: string, currentValue: boolean) => {
    setUpdating(userId);
    
    const { error } = await supabase
      .from("profiles")
      .update({ authorization_code_required: !currentValue })
      .eq("id", userId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update authorization code setting",
        variant: "destructive",
      });
      console.error(error);
    } else {
      toast({
        title: "Success",
        description: `Authorization code ${!currentValue ? "enabled" : "disabled"} for user`,
      });
      fetchUsers();
    }
    
    setUpdating(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Authorization Code Control</h1>
        <p className="text-muted-foreground">Enable or disable authorization code requirement for transfers</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Authorization Settings</CardTitle>
          <CardDescription>
            Toggle whether users need to enter the AC code (101010) when making transfers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">AC Code Required</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center">
                      <Switch
                        checked={user.authorization_code_required}
                        onCheckedChange={() => handleToggle(user.id, user.authorization_code_required)}
                        disabled={updating === user.id}
                      />
                      {updating === user.id && (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

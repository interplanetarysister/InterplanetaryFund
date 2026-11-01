import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ComposeMessage from "@/components/comms/ComposeMessage";
import MessageHistory from "@/components/comms/MessageHistory";
import CommPreferences from "@/components/comms/CommPreferences";
import PullToRefresh from "@/components/mobile/PullToRefresh";

export default function Communications() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <PullToRefresh onRefresh={() => setRefreshKey((k) => k + 1)} className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="font-display text-3xl sm:text-4xl text-stone-900 mb-2">Communications</h1>
      <p className="text-stone-500 mb-8">Reach your supporters — with their consent, on their terms.</p>

      <Tabs defaultValue="compose">
        <TabsList className="mb-6">
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>
        <TabsContent value="compose">
          <ComposeMessage onSent={() => setRefreshKey((k) => k + 1)} />
        </TabsContent>
        <TabsContent value="history">
          <MessageHistory refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="preferences">
          <CommPreferences />
        </TabsContent>
      </Tabs>
    </PullToRefresh>
  );
}
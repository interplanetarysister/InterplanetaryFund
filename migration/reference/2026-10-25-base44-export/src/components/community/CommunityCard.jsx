import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Image } from "@/components/ui/image";
import { Users, MapPin } from "lucide-react";
import { communityTypes } from "./communityTypes";

export default function CommunityCard({ community, isMember }) {
  return (
    <Link to={`/community/${community.id}`} className="group bg-white rounded-2xl border border-stone-200/70 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {community.cover_image_url ? (
        <Image src={community.cover_image_url} className="w-full h-28" alt={community.name} />
      ) : (
        <div className="w-full h-28 bg-gradient-to-br from-cyan-100 to-sky-100 flex items-center justify-center">
          <Users className="w-8 h-8 text-cyan-400" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-stone-900 group-hover:text-primary transition-colors">{community.name}</p>
          {isMember && <Badge className="bg-primary/10 text-primary hover:bg-primary/10 shrink-0">Joined</Badge>}
        </div>
        <p className="text-xs text-stone-500 mt-1 line-clamp-2">{community.description}</p>
        <div className="flex items-center gap-3 mt-3 text-xs text-stone-400">
          <Badge variant="secondary">{communityTypes[community.type] || community.type}</Badge>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {community.member_count || 1}</span>
          {community.location && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" /> {community.location}</span>}
        </div>
      </div>
    </Link>
  );
}
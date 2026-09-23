import { Mail, Phone, UserRound } from "lucide-react";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { SectionHeader } from "@/components/public/SectionHeader";
import { SCT_LEADERS, SCT_UNITS } from "@/data/leadership";
import { cn } from "@/lib/utils";

function Avatar({
  name,
  photo,
  className,
}: {
  name: string;
  photo?: string | undefined;
  className?: string;
}) {
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className={cn("size-full object-cover", className)}
        loading="lazy"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join("");
  return (
    <span
      className={cn(
        "grid size-full place-items-center bg-navy text-xl font-bold text-white",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function LeadershipPage() {
  return (
    <div className="min-h-screen bg-white text-foreground antialiased">
      <PublicHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Giới thiệu"
          title="Lãnh đạo đơn vị"
          description="Ban lãnh đạo và trưởng các phòng, đơn vị trực thuộc Sở Công Thương tỉnh Tây Ninh."
        />

        {/* Ban lãnh đạo */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SCT_LEADERS.map((l) => (
            <div
              key={l.name}
              className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
            >
              <div className="aspect-[4/3] w-full bg-surface">
                <Avatar name={l.name} photo={l.photo} className="mx-auto" />
              </div>
              <div className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gov">
                  {l.role}
                </p>
                <h3 className="mt-1 text-lg font-bold text-navy">{l.name}</h3>
                {l.duties ? <p className="mt-1 text-sm text-muted-foreground">{l.duties}</p> : null}
                <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  {l.mobile ? (
                    <p className="flex items-center gap-2">
                      <Phone className="size-3.5 text-gov" />
                      {l.mobile}
                    </p>
                  ) : null}
                  {l.phone ? (
                    <p className="flex items-center gap-2">
                      <Phone className="size-3.5 text-gov" />
                      {l.phone}
                    </p>
                  ) : null}
                  {l.email ? (
                    <p className="flex items-center gap-2">
                      <Mail className="size-3.5 text-gov" />
                      <a href={`mailto:${l.email}`} className="hover:underline">
                        {l.email}
                      </a>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Các phòng, đơn vị trực thuộc */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight text-navy">
            Trưởng các phòng, đơn vị trực thuộc
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Danh sách lãnh đạo các phòng chuyên môn và đơn vị trực thuộc Sở Công Thương.
          </p>
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <ul className="divide-y divide-border">
              {SCT_UNITS.map((u, i) => (
                <li key={u.unit} className="grid gap-3 px-5 py-4 sm:grid-cols-3 sm:items-center">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-gov">
                      <UserRound className="size-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-navy">{u.unit}</p>
                      <p className="text-xs text-muted-foreground">
                        {i + 1}. {u.title}
                      </p>
                    </div>
                  </div>
                  <p className="pl-10 break-words text-sm font-medium text-navy sm:pl-0">
                    {u.name}
                  </p>
                  <div className="space-y-0.5 pl-10 break-words text-xs text-muted-foreground sm:pl-0">
                    {u.officePhone ? <p>ĐT CQ: {u.officePhone}</p> : null}
                    {u.mobile ? <p>Di động: {u.mobile}</p> : null}
                    {u.email ? (
                      <p>
                        Email:{" "}
                        <a
                          href={`mailto:${u.email}`}
                          className="font-medium break-all text-gov hover:underline"
                        >
                          {u.email}
                        </a>
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

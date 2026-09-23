import { Link } from "@/lib/router-compat";
import { ExternalLink, Landmark, Mail, MapPin, Phone } from "lucide-react";
import { SITE_CONFIG } from "@/lib/site-config";

const QUICK_LINKS: {
  label: string;
  to: "/trang-thong-tin" | "/industrial-clusters";
  muc?: string;
}[] = [
  { label: "Tin tức", to: "/trang-thong-tin", muc: "tin-tuc" },
  { label: "Sự kiện", to: "/trang-thong-tin", muc: "su-kien" },
  { label: "Cơ hội đầu tư", to: "/trang-thong-tin", muc: "dau-tu" },
  { label: "Khuyến mại", to: "/trang-thong-tin", muc: "khuyen-mai" },
  { label: "Thông tin thị trường", to: "/trang-thong-tin", muc: "thi-truong" },
  { label: "GIS Khu/Cụm công nghiệp", to: "/industrial-clusters" },
];

export function PublicFooter() {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-white/10">
              <Landmark className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-wide">
                {SITE_CONFIG.organization.fullName}
              </p>
              <p className="text-[11px] text-white/60">{SITE_CONFIG.organization.subtitle}</p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-white/70">
            Cổng thông tin công khai cung cấp tin tức, sự kiện, xúc tiến thương mại, cơ hội đầu tư
            và thông tin thị trường phục vụ doanh nghiệp, nhà đầu tư và người dân.
          </p>
        </div>

        <div>
          <p className="mb-4 text-sm font-bold uppercase tracking-wider text-white/80">
            Liên kết nhanh
          </p>
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {QUICK_LINKS.map((l) => {
              if (l.to === "/industrial-clusters") {
                return (
                  <li key={l.label}>
                    <a
                      href={l.to}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
                    >
                      {l.label} <ExternalLink className="size-3.5 opacity-70" />
                    </a>
                  </li>
                );
              }
              return (
                <li key={l.label}>
                  <Link
                    to="/trang-thong-tin"
                    search={l.muc ? { muc: l.muc } : {}}
                    className="inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="mb-4 text-sm font-bold uppercase tracking-wider text-white/80">
            Thông tin liên hệ
          </p>
          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-teal-300" />
              <span>{SITE_CONFIG.contact.address}</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="size-4 shrink-0 text-teal-300" />
              <a
                href={SITE_CONFIG.contact.phoneHref}
                className="transition-colors hover:text-white"
              >
                {SITE_CONFIG.contact.phone}
              </a>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="size-4 shrink-0 text-teal-300" />
              <a
                href={SITE_CONFIG.contact.emailHref}
                className="transition-colors hover:text-white"
              >
                {SITE_CONFIG.contact.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[11px] text-white/50 sm:px-6 lg:px-8">
          <p>© 2026 {SITE_CONFIG.organization.fullName}. Bảo lưu mọi quyền.</p>
          <p>Nội dung công khai trên cổng được phê duyệt trước khi đăng tải.</p>
        </div>
      </div>
    </footer>
  );
}

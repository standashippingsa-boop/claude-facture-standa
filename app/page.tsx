// app/page.tsx
import { ArrowRight, Package, Users, FileText, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* --- HERO SECTION (Ble fonse a) --- */}
      <section className="relative bg-primary text-white pt-20 pb-32 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="bg-blue-500/20 text-blue-300 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider">
              Standa Commercial v6
            </span>
            <h1 className="text-5xl md:text-6xl font-extrabold mt-6 leading-tight">
              Solisyon Fyab pou <br />
              <span className="text-accent">Jesyon Koli ou</span>
            </h1>
            <p className="text-blue-100 mt-6 text-lg max-w-md">
              Senkronize MCPACK, jere kliyan ou yo, epi jenere faktire pwofesyonèl an segonn.
            </p>
            <div className="flex gap-4 mt-10">
              <Link href="/dashboard" className="bg-white text-primary px-8 py-4 rounded-full font-bold hover:bg-blue-50 transition-all flex items-center gap-2">
                Antre nan Sistèm nan <ArrowRight size={20} />
              </Link>
              <Link href="/inscription" className="border border-white/30 px-8 py-4 rounded-full font-bold hover:bg-white/10 transition-all">
                Kreye yon Kont
              </Link>
            </div>
          </div>

          {/* Imaj la (Mete yon imaj kamyon oswa depo isit la) */}
          <div className="relative">
            <div className="bg-gradient-to-tr from-accent/20 to-transparent absolute inset-0 rounded-full blur-3xl"></div>
            <img 
              src="/hero-image.webp" 
              alt="Management" 
              className="relative z-10 w-full h-auto rounded-3xl"
            />
          </div>
        </div>
      </section>

      {/* --- SECTION BLANCH (Fòm awondi a) --- */}
      <section className="-mt-16 relative z-20 bg-white rounded-t-[5rem] px-6 pt-24 pb-20">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-primary">Poukisa Chwazi Nou?</h2>
          <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
            Sistèm nou an fèt espesyalman pou ajans koli ki vle modènize workflow yo.
          </p>

          {/* GRID SÈVIS (Menm jan ak imaj 2 a) */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <ServiceCard 
              icon={<Package className="text-accent" size={40} />}
              title="Tracking Otomatik"
              desc="Swiv chak koli depi Miami rive Ayiti san pèdi fil."
            />
            <ServiceCard 
              icon={<FileText className="text-accent" size={40} />}
              title="Faktirasyon PDF"
              desc="Jenere faktire an USD/HTG ak kalkil tax otomatik."
            />
            <ServiceCard 
              icon={<Users className="text-accent" size={40} />}
              title="Espace Client"
              desc="Kliyan ou yo ka konekte pou wè koli yo ak adrès depo yo."
            />
          </div>
        </div>
      </section>

      {/* --- STATISTICS (Ble anba a) --- */}
      <section className="bg-primary-soft py-20 px-6">
        <div className="max-w-7xl mx-auto bg-primary rounded-4xl p-12 grid md:grid-cols-3 gap-8 text-center text-white">
          <div>
            <div className="text-5xl font-bold">24,756</div>
            <p className="text-blue-300 mt-2">Koli Livre</p>
          </div>
          <div>
            <div className="text-5xl font-bold">04,786</div>
            <p className="text-blue-300 mt-2">Kliyan Actif</p>
          </div>
          <div>
            <div className="text-5xl font-bold">04,930</div>
            <p className="text-blue-300 mt-2">Faktire Jenere</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ServiceCard({ icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="p-10 rounded-4xl bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all text-left group">
      <div className="mb-6 group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="text-2xl font-bold text-primary mb-4">{title}</h3>
      <p className="text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

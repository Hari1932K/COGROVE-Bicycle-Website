-- ============ enums ============
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.bike_category AS ENUM ('road', 'mountain', 'gravel', 'city', 'ebike', 'bmx', 'kids');
CREATE TYPE public.bike_condition AS ENUM ('new', 'like_new', 'good', 'fair', 'project');
CREATE TYPE public.listing_status AS ENUM ('active', 'sold', 'draft');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- ============ shared trigger fn ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Rider',
  avatar_url TEXT,
  location TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are publicly viewable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1), 'Rider'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ roles ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ============ marketplace listings ============
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT,
  category public.bike_category NOT NULL DEFAULT 'road',
  condition public.bike_condition NOT NULL DEFAULT 'good',
  frame_size TEXT,
  year INTEGER,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  location TEXT,
  description TEXT,
  image_url TEXT,
  status public.listing_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX listings_category_idx ON public.listings (category);
CREATE INDEX listings_seller_idx ON public.listings (seller_id);
GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active listings are public" ON public.listings FOR SELECT USING (status <> 'draft');
CREATE POLICY "Sellers read own listings" ON public.listings FOR SELECT TO authenticated USING (auth.uid() = seller_id);
CREATE POLICY "Sellers create own listings" ON public.listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers update own listings" ON public.listings FOR UPDATE TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers delete own listings" ON public.listings FOR DELETE TO authenticated USING (auth.uid() = seller_id);
CREATE TRIGGER listings_updated_at BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ favorites ============
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON public.favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ rental fleet ============
CREATE TABLE public.rental_bikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category public.bike_category NOT NULL DEFAULT 'city',
  frame_size TEXT,
  daily_rate_cents INTEGER NOT NULL CHECK (daily_rate_cents >= 0),
  description TEXT,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rental_bikes TO anon;
GRANT SELECT ON public.rental_bikes TO authenticated;
GRANT ALL ON public.rental_bikes TO service_role;
ALTER TABLE public.rental_bikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rental fleet is public" ON public.rental_bikes FOR SELECT USING (true);
CREATE POLICY "Admins manage rental fleet" ON public.rental_bikes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER rental_bikes_updated_at BEFORE UPDATE ON public.rental_bikes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.rental_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rental_bike_id UUID NOT NULL REFERENCES public.rental_bikes(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_cents INTEGER NOT NULL DEFAULT 0,
  status public.booking_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_bookings TO authenticated;
GRANT ALL ON public.rental_bookings TO service_role;
ALTER TABLE public.rental_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rental bookings" ON public.rental_bookings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER rental_bookings_updated_at BEFORE UPDATE ON public.rental_bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_rental_dates()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'End date must be on or after the start date';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER rental_bookings_validate BEFORE INSERT OR UPDATE ON public.rental_bookings FOR EACH ROW EXECUTE FUNCTION public.validate_rental_dates();

-- ============ service ============
CREATE TABLE public.service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_types TO anon;
GRANT SELECT ON public.service_types TO authenticated;
GRANT ALL ON public.service_types TO service_role;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service catalog is public" ON public.service_types FOR SELECT USING (true);
CREATE POLICY "Admins manage service catalog" ON public.service_types FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.service_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE RESTRICT,
  bike_description TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_bookings TO authenticated;
GRANT ALL ON public.service_bookings TO service_role;
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own service bookings" ON public.service_bookings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER service_bookings_updated_at BEFORE UPDATE ON public.service_bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ gear shop ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'accessories',
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are public" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cents INTEGER NOT NULL DEFAULT 0,
  status public.booking_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own orders" ON public.orders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ seed data ============
INSERT INTO public.listings (title, brand, model, category, condition, frame_size, year, price_cents, location, description, image_url) VALUES
('Cannondale SuperSix EVO Carbon', 'Cannondale', 'SuperSix EVO', 'road', 'like_new', '56', 2022, 289000, 'Portland, OR', 'Full carbon race bike, Ultegra Di2, under 2000 km. Fresh bar tape and new chain.', '/images/bike-road.jpg'),
('Santa Cruz Hightower C', 'Santa Cruz', 'Hightower C', 'mountain', 'good', 'L', 2021, 342000, 'Boulder, CO', '140mm trail slayer. Fox 36 recently serviced, DT Swiss wheels, no cracks or dents.', '/images/bike-mountain.jpg'),
('Specialized Diverge Comp', 'Specialized', 'Diverge Comp', 'gravel', 'good', '54', 2020, 198000, 'Austin, TX', 'Future Shock front end, 700x42 tyres, mounts everywhere. Perfect bikepacking rig.', '/images/bike-gravel.jpg'),
('Brooklyn Bedford Single Speed', 'Brooklyn', 'Bedford', 'city', 'like_new', 'M', 2023, 52000, 'Brooklyn, NY', 'Clean flip-flop hub commuter. Barely ridden, includes fenders and rear rack.', '/images/bike-city.jpg'),
('Trek Rail 7 E-MTB', 'Trek', 'Rail 7', 'ebike', 'good', 'M', 2022, 445000, 'Seattle, WA', 'Bosch Performance CX, 625Wh battery, 84% health. Includes charger and spare tyre.', '/images/bike-ebike.jpg'),
('Bianchi Sprint Celeste', 'Bianchi', 'Sprint', 'road', 'good', '53', 2019, 154000, 'Chicago, IL', 'Iconic celeste paint, 105 groupset. Small chip on the down tube, otherwise sharp.', '/images/bike-road.jpg'),
('Kona Process 134 Project', 'Kona', 'Process 134', 'mountain', 'project', 'M', 2017, 68000, 'Denver, CO', 'Frame and fork only project build. Needs a rear shock rebuild, priced accordingly.', '/images/bike-mountain.jpg'),
('Rove ST Steel Tourer', 'Kona', 'Rove ST', 'gravel', 'like_new', '56', 2023, 172000, 'Minneapolis, MN', 'Steel is real. Loaded tourer with dynamo hub and Tubus racks front and rear.', '/images/bike-gravel.jpg');

INSERT INTO public.rental_bikes (name, category, frame_size, daily_rate_cents, description, image_url) VALUES
('City Cruiser 7-Speed', 'city', 'M', 2500, 'Upright and comfy. Basket, lights and lock included — ideal for a day in town.', '/images/bike-city.jpg'),
('Carbon Road Racer', 'road', '54', 6500, 'Full carbon with clipless pedals available. Built for fast group rides.', '/images/bike-road.jpg'),
('Trail Full Suspension', 'mountain', 'L', 7500, '140mm travel trail bike, tubeless, with dropper post. Helmet included.', '/images/bike-mountain.jpg'),
('Gravel Adventure', 'gravel', '56', 5500, 'Wide tyres and bikepacking mounts. Great for mixed-surface day trips.', '/images/bike-gravel.jpg'),
('E-Commuter Step-Through', 'ebike', 'M', 4500, '80 km range pedal assist. Effortless hills, integrated rack and lights.', '/images/bike-ebike.jpg'),
('Kids 20-inch Explorer', 'kids', '20"', 1500, 'Lightweight kids bike with hand brakes. Helmet included with every rental.', '/images/bike-city.jpg');

INSERT INTO public.service_types (name, description, price_cents, duration_minutes) VALUES
('Safety Check', 'Quick 20-point inspection of brakes, drivetrain, bolts and tyre pressure.', 3500, 30),
('Standard Tune-Up', 'Gear and brake adjustment, drivetrain clean, wheel true and full bolt check.', 9500, 90),
('Pro Overhaul', 'Full strip, degrease and rebuild. New cables, bearing service and rebuilt wheels.', 27500, 240),
('Wheel Build', 'Hand-built wheel with even tension and stress relief. Parts quoted separately.', 12000, 120),
('Suspension Service', 'Lower-leg and air-can service for fork or shock, with fresh oil and seals.', 16500, 150),
('E-Bike Diagnostic', 'Motor and battery health report, firmware update and drivetrain check.', 8500, 60);

INSERT INTO public.products (name, category, description, price_cents, stock, image_url) VALUES
('Aero Road Helmet', 'helmets', 'MIPS-equipped aero lid with 18 vents. Weighs 265g in size medium.', 18900, 24, '/images/gear-helmet.jpg'),
('Thermal Bib Tights', 'apparel', 'Fleece-backed winter bibs with an anatomic chamois and reflective ankles.', 14500, 18, '/images/gear-apparel.jpg'),
('USB Light Set 1200lm', 'lights', 'Front and rear pair with 1200 lumen high beam and 20 hour flash mode.', 7900, 40, '/images/gear-lights.jpg'),
('Tubeless Repair Kit', 'tools', 'Plugs, reamer, valve core tool and 60ml sealant in a saddle-bag-sized case.', 3400, 60, '/images/gear-tools.jpg'),
('Frame Bag 4L', 'bags', 'Water-resistant half-frame bag with internal divider and cable port.', 8900, 15, '/images/gear-bags.jpg'),
('Carbon Bottle Cage', 'accessories', 'UD carbon cage, 22g, holds bottles securely over rough gravel.', 4200, 32, '/images/gear-tools.jpg'),
('Merino Base Layer', 'apparel', '150gsm merino long sleeve. Warm when wet, odour resistant on tours.', 9800, 22, '/images/gear-apparel.jpg'),
('Torque Wrench 2-14Nm', 'tools', 'Click-type torque wrench with a 10-bit set for carbon-safe assembly.', 11900, 12, '/images/gear-tools.jpg');
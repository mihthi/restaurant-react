/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
// --- THÊM ROUTER: Import các hook và hàm khởi tạo của TanStack Router ---
import {
  createRouter,
  createRoute,
  createRootRoute,
  RouterProvider,
  useRouterState,
  useNavigate,
} from '@tanstack/react-router';
// -------------------------------------------------------------------------
import { MonAn, CheDoXem, ThongBaoThanhCong } from './types/food';
import { foodApi } from './services/foodApi';
import { dinhDangTienVND } from './data/initialFoods';
import { Header } from './components/Header';
import { MenuSection } from './components/MenuSection';
import { ManagementSection } from './components/ManagementSection';
import { FoodDetailModal } from './components/FoodDetailModal';
import { FoodFormModal } from './components/FoodFormModal';
import { ConfirmModal } from './components/ConfirmModal';
import { SuccessPopupModal } from './components/SuccessPopupModal';
import { Footer } from './components/Footer';
import { Loader2 } from 'lucide-react';

// --- THÊM ROUTER: Khởi tạo các Route ---
const rootRoute = createRootRoute({
  component: AppContent,
});

const thucDonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/', // Đường dẫn trang chủ (Thực đơn)
});

const quanLyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/quan-ly', // Đường dẫn trang quản lý
});

const routeTree = rootRoute.addChildren([thucDonRoute, quanLyRoute]);
const router = createRouter({ routeTree });

// Đăng ký type an toàn cho TypeScript
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
// ---------------------------------------

// Khởi tạo QueryClient cho TanStack Query với cấu hình thời gian cache (staleTime 5 phút)
const quanLyTruyVan = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const queryClient = useQueryClient();

  // --- THÊM ROUTER: Đổi từ useState sang quản lý bằng URL ---
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  // Xác định chế độ hiển thị dựa trên URL hiện tại
  const cheDoHienTai: CheDoXem = pathname === '/quan-ly' ? 'quan-ly' : 'thuc-don';
  // ----------------------------------------------------------

  // Trạng thái các Modal (Giữ nguyên hoàn toàn)
  const [monAnDangXemChiTiet, setMonAnDangXemChiTiet] = useState<MonAn | null>(null);
  const [dangMoModalBieuMau, setDangMoModalBieuMau] = useState(false);
  const [monAnCanChinhSua, setMonAnCanChinhSua] = useState<MonAn | null>(null);

  // Trạng thái xóa món (Giữ nguyên hoàn toàn)
  const [monAnCanXoa, setMonAnCanXoa] = useState<MonAn | null>(null);
  const [danhSachIdCanXoaHangLoat, setDanhSachIdCanXoaHangLoat] = useState<string[] | null>(null);

  // Trạng thái Popup thông báo thành công ở giữa màn hình (Giữ nguyên hoàn toàn)
  const [thongBaoThanhCong, setThongBaoThanhCong] = useState<ThongBaoThanhCong>({
    dangMo: false,
    loaiThaoTac: 'them',
    tieuDe: '',
    noiDung: '',
  });

  // Query: Lấy danh sách món ăn từ Server State (mock API)
  const { data: danhSachMonAn = [], isLoading: dangTaiDuLieu } = useQuery({
    queryKey: ['danh-sach-mon-an'],
    queryFn: foodApi.layDanhSachMonAn,
  });

  // Mutation: Thêm món ăn mới
  const mutationThemMon = useMutation({
    mutationFn: (monMoi: Omit<MonAn, 'id'>) => foodApi.themMonAnMoi(monMoi),
    onSuccess: (monVuaThem) => {
      queryClient.invalidateQueries({ queryKey: ['danh-sach-mon-an'] });
      setDangMoModalBieuMau(false);
      setMonAnCanChinhSua(null);
      setThongBaoThanhCong({
        dangMo: true,
        loaiThaoTac: 'them',
        tieuDe: 'Thêm Món Ăn Thành Công!',
        noiDung: `Món "${monVuaThem.ten}" đã được thêm vào thực đơn với giá bán ${dinhDangTienVND(monVuaThem.gia)}.`,
      });
    },
  });

  // Mutation: Cập nhật chỉnh sửa món ăn
  const mutationCapNhatMon = useMutation({
    mutationFn: (monCapNhat: MonAn) => foodApi.capNhatMonAn(monCapNhat),
    onSuccess: (monVuaSua) => {
      queryClient.invalidateQueries({ queryKey: ['danh-sach-mon-an'] });
      setDangMoModalBieuMau(false);
      setMonAnCanChinhSua(null);
      setThongBaoThanhCong({
        dangMo: true,
        loaiThaoTac: 'sua',
        tieuDe: 'Cập Nhật Món Ăn Thành Công!',
        noiDung: `Thông tin món "${monVuaSua.ten}" đã được cập nhật thành công trong hệ thống.`,
      });
    },
  });

  // Mutation: Xóa 1 món ăn với Optimistic Update & Rollback
  const mutationXoaMotMon = useMutation({
    mutationFn: (idMon: string) => foodApi.xoaMotMonAn(idMon),
    onMutate: async (idMon: string) => {
      await queryClient.cancelQueries({ queryKey: ['danh-sach-mon-an'] });
      const duLieuTruocKhiXoa = queryClient.getQueryData<MonAn[]>(['danh-sach-mon-an']);
      if (duLieuTruocKhiXoa) {
        queryClient.setQueryData<MonAn[]>(
          ['danh-sach-mon-an'],
          duLieuTruocKhiXoa.filter((mon) => mon.id !== idMon)
        );
      }
      return { duLieuTruocKhiXoa };
    },
    onError: (_loi, _id, nguCanh) => {
      if (nguCanh?.duLieuTruocKhiXoa) {
        queryClient.setQueryData(['danh-sach-mon-an'], nguCanh.duLieuTruocKhiXoa);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['danh-sach-mon-an'] });
    },
    onSuccess: () => {
      const tenMonBiXoa = monAnCanXoa?.ten || 'Món ăn';
      setMonAnCanXoa(null);
      setThongBaoThanhCong({
        dangMo: true,
        loaiThaoTac: 'xoa',
        tieuDe: 'Đã Xóa Món Ăn!',
        noiDung: `Món "${tenMonBiXoa}" đã được gỡ bỏ hoàn toàn khỏi danh sách thực đơn.`,
      });
    },
  });

  // Mutation: Xóa nhiều món ăn được chọn (Xóa hàng loạt) với Optimistic Update & Rollback
  const mutationXoaNhieuMon = useMutation({
    mutationFn: (danhSachId: string[]) => foodApi.xoaNhieuMonAn(danhSachId),
    onMutate: async (danhSachId: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['danh-sach-mon-an'] });
      const duLieuTruocKhiXoa = queryClient.getQueryData<MonAn[]>(['danh-sach-mon-an']);
      if (duLieuTruocKhiXoa) {
        queryClient.setQueryData<MonAn[]>(
          ['danh-sach-mon-an'],
          duLieuTruocKhiXoa.filter((mon) => !danhSachId.includes(mon.id))
        );
      }
      return { duLieuTruocKhiXoa };
    },
    onError: (_loi, _ids, nguCanh) => {
      if (nguCanh?.duLieuTruocKhiXoa) {
        queryClient.setQueryData(['danh-sach-mon-an'], nguCanh.duLieuTruocKhiXoa);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['danh-sach-mon-an'] });
    },
    onSuccess: (cacIdDaXoa) => {
      const soLuongXoa = cacIdDaXoa.length;
      setDanhSachIdCanXoaHangLoat(null);
      setThongBaoThanhCong({
        dangMo: true,
        loaiThaoTac: 'xoa-hang-loat',
        tieuDe: 'Xóa Nhiều Món Ăn Thành Công!',
        noiDung: `Đã xóa thành công ${soLuongXoa} món ăn được lựa chọn khỏi hệ thống quản lý.`,
      });
    },
  });

  // Xử lý lưu món ăn (Thêm mới hoặc Cập nhật)
  const xuLyLuuMonAn = (duLieuMon: Omit<MonAn, 'id'> & { id?: string }) => {
    if (duLieuMon.id) {
      mutationCapNhatMon.mutate(duLieuMon as MonAn);
    } else {
      mutationThemMon.mutate({
        ten: duLieuMon.ten,
        phanLoai: duLieuMon.phanLoai,
        gia: duLieuMon.gia,
        anh: duLieuMon.anh,
        moTa: duLieuMon.moTa,
      });
    }
  };

  const moModalThemMon = () => {
    setMonAnCanChinhSua(null);
    setDangMoModalBieuMau(true);
  };

  const moModalChinhSuaMon = (monAn: MonAn) => {
    setMonAnCanChinhSua(monAn);
    setDangMoModalBieuMau(true);
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-sans">
      {/* Thanh Header */}
      <Header
        cheDoXem={cheDoHienTai}
        // --- THÊM ROUTER: Chuyển hướng URL thay vì dùng setCheDoHienTai ---
        doiCheDoXem={(cheDo) => {
          navigate({ to: cheDo === 'thuc-don' ? '/' : '/quan-ly' });
        }}
        // -------------------------------------------------------------------
        tongSoMon={danhSachMonAn.length}
      />

      {/* Vùng nội dung chính */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {dangTaiDuLieu ? (
          <div className="py-24 flex flex-col items-center justify-center text-stone-500">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-2" />
            <p className="text-xs font-medium">Đang tải danh sách món ăn từ TanStack Query...</p>
          </div>
        ) : cheDoHienTai === 'thuc-don' ? (
          <MenuSection
            danhSachMonAn={danhSachMonAn}
            chonXemChiTietMon={(monAn) => setMonAnDangXemChiTiet(monAn)}
          />
        ) : (
          <ManagementSection
            danhSachMonAn={danhSachMonAn}
            xemChiTietMon={(monAn) => setMonAnDangXemChiTiet(monAn)}
            chinhSuaMon={moModalChinhSuaMon}
            xoaMotMon={(monAn) => setMonAnCanXoa(monAn)}
            xoaNhieuMon={(cacId) => setDanhSachIdCanXoaHangLoat(cacId)}
            moPopupThemMon={moModalThemMon}
          />
        )}
      </main>

      <Footer />

      {/* 1. Modal xem chi tiết món ăn */}
      <FoodDetailModal
        monAn={monAnDangXemChiTiet}
        dangMo={!!monAnDangXemChiTiet}
        dongModal={() => setMonAnDangXemChiTiet(null)}
      />

      {/* 2. Modal biểu mẫu Thêm / Chỉnh sửa món ăn */}
      <FoodFormModal
        dangMo={dangMoModalBieuMau}
        dongModal={() => {
          setDangMoModalBieuMau(false);
          setMonAnCanChinhSua(null);
        }}
        xuLyLuuMonAn={xuLyLuuMonAn}
        monAnCanSua={monAnCanChinhSua}
      />

      {/* 3. Modal xác nhận xóa 1 món */}
      <ConfirmModal
        dangMo={!!monAnCanXoa}
        tieuDe="Xác nhận xóa món ăn"
        moTaChiTiet={`Bạn có chắc chắn muốn xóa "${monAnCanXoa?.ten}" khỏi danh sách? Thao tác này không thể hoàn tác.`}
        nhanNutXacNhan="Xóa món này"
        nhanNutHuy="Hủy"
        xuLyXacNhan={() => {
          if (monAnCanXoa) {
            mutationXoaMotMon.mutate(monAnCanXoa.id);
          }
        }}
        dongModal={() => setMonAnCanXoa(null)}
      />

      {/* 4. Modal xác nhận xóa nhiều món đã chọn */}
      <ConfirmModal
        dangMo={!!danhSachIdCanXoaHangLoat && danhSachIdCanXoaHangLoat.length > 0}
        tieuDe="Xác nhận xóa hàng loạt"
        moTaChiTiet="Bạn đang yêu cầu xóa nhiều món ăn được tích chọn. Các món đã chọn sẽ bị gỡ bỏ hoàn toàn."
        soLuongMonAnhHuong={danhSachIdCanXoaHangLoat ? danhSachIdCanXoaHangLoat.length : 0}
        nhanNutXacNhan={`Xóa ${danhSachIdCanXoaHangLoat ? danhSachIdCanXoaHangLoat.length : 0} món đã chọn`}
        nhanNutHuy="Hủy"
        xuLyXacNhan={() => {
          if (danhSachIdCanXoaHangLoat) {
            mutationXoaNhieuMon.mutate(danhSachIdCanXoaHangLoat);
          }
        }}
        dongModal={() => setDanhSachIdCanXoaHangLoat(null)}
      />

      {/* 5. Pop-up thông báo thành công (Thêm, Sửa, Xóa) */}
      <SuccessPopupModal
        thongBao={thongBaoThanhCong}
        dongPopup={() => setThongBaoThanhCong((cu) => ({ ...cu, dangMo: false }))}
      />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={quanLyTruyVan}>
      {/* --- THÊM ROUTER: Cung cấp Router cho toàn bộ ứng dụng --- */}
      <RouterProvider router={router} />
      {/* --------------------------------------------------------- */}
    </QueryClientProvider>
  );
}
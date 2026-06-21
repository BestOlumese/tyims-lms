"use client";

import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { 
  User, 
  Mail, 
  Phone, 
  Globe, 
  Loader2,
  Save,
  Camera,
  X,
  Crop as CropIcon,
  Check,
  Eye,
  EyeOff
} from "lucide-react";
import { FaFacebook, FaInstagram, FaXTwitter, FaLinkedin } from "react-icons/fa6";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { uploadFiles } from "@/lib/uploadthing-utils";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  title: z.string().optional().nullable(),
  aboutMe: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  facebookUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  instagramUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  xUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  linkedinUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

export const SettingsClient = ({ user }: { user: any }) => {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Image Crop State
  const [upImg, setUpImg] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(user.image || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user.name || "",
      title: user.title || "",
      aboutMe: user.aboutMe || "",
      phone: user.phone || "",
      website: user.website || "",
      facebookUrl: user.facebookUrl || "",
      instagramUrl: user.instagramUrl || "",
      xUrl: user.xUrl || "",
      linkedinUrl: user.linkedinUrl || "",
    },
  });

  const { refetch: refetchSession } = authClient.useSession();
  const updateMutation = useMutation(orpc.instructor.updateInstructorProfile.mutationOptions());

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({
        ...values,
        image: profileImage,
      });
      
      // Update local session to reflect in topbar
      await refetchSession();
      
      toast.success("Profile updated successfully");
      form.reset(values); // Reset dirty state
      router.refresh();
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        newPassword,
        currentPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        toast.error(error.message || "Failed to change password");
      } else {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // --- Image Cropping Logic ---
  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setUpImg(reader.result?.toString() || null);
        setIsCropping(true);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
      width,
      height
    );
    setCrop(crop);
  }, []);

  const generateCroppedImage = async (image: HTMLImageElement, crop: any): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error("No 2d context");

    const pixelRatio = window.devicePixelRatio;
    canvas.width = crop.width * pixelRatio;
    canvas.height = crop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  const handleUploadCroppedImage = async () => {
    if (!completedCrop || !imgRef.current) return;
    
    setIsUploadingImage(true);
    try {
      const blob = await generateCroppedImage(imgRef.current, completedCrop);
      const file = new File([blob], "profile.jpg", { type: "image/jpeg" });
      
      const res = await uploadFiles("courseImage", {
        files: [file],
      });
      
      if (res && res[0]) {
        setProfileImage(res[0].url);
        toast.success("Profile picture updated");
        setIsCropping(false);
        form.setValue("name", form.getValues("name"), { shouldDirty: true }); // Trigger dirty state to enable save
      }
    } catch (error) {
      toast.error("Failed to upload image");
      console.error(error);
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Instructor Settings</h1>
        <p className="text-[13px] text-gray-500 font-medium mt-1">Manage your public profile and contact information.</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Profile Picture Section */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Profile Picture</h2>
          
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="relative group shrink-0">
              {profileImage ? (
                <img 
                  src={profileImage} 
                  alt="Profile" 
                  className="w-32 h-32 rounded-2xl object-cover border-4 border-gray-50 shadow-md"
                />
              ) : (
                <div className="w-32 h-32 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-4xl border-4 border-white shadow-md">
                  {form.watch("name")?.charAt(0).toUpperCase() || "I"}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
              >
                <Camera size={24} />
              </button>
            </div>
            
            <div>
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={onSelectFile} 
                className="hidden" 
              />
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[13px] font-bold hover:bg-indigo-100 transition-colors"
                >
                  Upload New Picture
                </button>
                <p className="text-[12px] text-gray-500 font-medium">
                  Recommended size: 500x500px. Maximum file size: 4MB.<br/>
                  You can crop the image before uploading.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Basic Info Section */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  {...form.register("name")}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="e.g. Jane Doe"
                />
              </div>
              {form.formState.errors.name && <p className="text-[11px] text-rose-500 font-bold ml-1">{form.formState.errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">Professional Title</label>
              <input
                {...form.register("title")}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                placeholder="e.g. Senior Software Engineer"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">About Me (Bio)</label>
              <textarea
                {...form.register("aboutMe")}
                rows={4}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                placeholder="Write a brief professional bio that students will see on your course pages..."
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Contact Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-gray-100 rounded-xl text-[13px] font-medium text-gray-500 cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-gray-400 ml-1">Email cannot be changed directly.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">Phone Number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  {...form.register("phone")}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">Personal Website</label>
              <div className="relative">
                <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  {...form.register("website")}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="https://yourwebsite.com"
                />
              </div>
              {form.formState.errors.website && <p className="text-[11px] text-rose-500 font-bold ml-1">{form.formState.errors.website.message}</p>}
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Social Media</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">LinkedIn Profile</label>
              <div className="relative">
                <FaLinkedin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  {...form.register("linkedinUrl")}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
              {form.formState.errors.linkedinUrl && <p className="text-[11px] text-rose-500 font-bold ml-1">{form.formState.errors.linkedinUrl.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">X (Twitter) Profile</label>
              <div className="relative">
                <FaXTwitter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  {...form.register("xUrl")}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="https://x.com/username"
                />
              </div>
              {form.formState.errors.xUrl && <p className="text-[11px] text-rose-500 font-bold ml-1">{form.formState.errors.xUrl.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">Facebook Profile</label>
              <div className="relative">
                <FaFacebook size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  {...form.register("facebookUrl")}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="https://facebook.com/username"
                />
              </div>
              {form.formState.errors.facebookUrl && <p className="text-[11px] text-rose-500 font-bold ml-1">{form.formState.errors.facebookUrl.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">Instagram Profile</label>
              <div className="relative">
                <FaInstagram size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  {...form.register("instagramUrl")}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="https://instagram.com/username"
                />
              </div>
              {form.formState.errors.instagramUrl && <p className="text-[11px] text-rose-500 font-bold ml-1">{form.formState.errors.instagramUrl.message}</p>}
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSaving || (!form.formState.isDirty && profileImage === user.image)}
            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl text-[13px] font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100"
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Save All Changes
          </button>
        </div>
      </form>

      {/* Change Password Section */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-gray-700 ml-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[13px] font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {isChangingPassword ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Update Password
            </button>
          </div>
        </form>
      </div>

      {/* Cropping Modal */}
      {isCropping && upImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <CropIcon size={20} className="text-indigo-600" />
                <h3 className="text-[16px] font-bold text-gray-900">Crop Profile Picture</h3>
              </div>
              <button 
                onClick={() => {
                  setIsCropping(false);
                  setUpImg(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 bg-gray-50 flex-1 overflow-auto flex items-center justify-center">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                className="max-h-[50vh]"
              >
                <img
                  ref={imgRef}
                  alt="Crop preview"
                  src={upImg}
                  onLoad={onImageLoad}
                  className="max-w-full max-h-[50vh]"
                />
              </ReactCrop>
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0">
              <button
                onClick={() => {
                  setIsCropping(false);
                  setUpImg(null);
                }}
                className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-gray-600 hover:bg-gray-50 border border-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadCroppedImage}
                disabled={!completedCrop?.width || !completedCrop?.height || isUploadingImage}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100"
              >
                {isUploadingImage ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Save Picture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
